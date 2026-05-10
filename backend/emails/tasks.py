import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import certifi
from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _send_via_zoho(credential, subject: str, body_text: str, body_html: str,
                   to_email: str, reply_to: str | None = None) -> None:
    """Send an email using an SDR's Zoho credentials directly via smtplib.

    Uses the SDR's own zoho_email as the FROM address.
    Raises smtplib.SMTPException on failure.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"LexTalk World <{credential.zoho_email}>"
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    ctx = ssl.create_default_context(cafile=certifi.where())
    with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.login(credential.zoho_email, credential.app_password)
        server.sendmail(credential.zoho_email, [to_email], msg.as_string())


# ─── Send task ───────────────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 min between retries
    name="emails.send_scheduled_email",
)
def send_scheduled_email(self, scheduled_email_id: str) -> str:
    """Send one ScheduledEmail and mark it SENT or FAILED.

    Retries up to 3 times (5 min apart) on transient SMTP errors.
    Non-retryable errors (bad recipient, auth failure) go straight to FAILED.

    Returns a short status string for logging/result inspection.
    """
    from .models import ScheduledEmail  # local import avoids circular at module load

    try:
        email = ScheduledEmail.objects.select_related("lead").get(pk=scheduled_email_id)
    except ScheduledEmail.DoesNotExist:
        logger.error("send_scheduled_email: ScheduledEmail %s not found", scheduled_email_id)
        return "not_found"

    # Idempotency guard — don't re-send if already processed.
    if email.status != ScheduledEmail.Status.PENDING:
        logger.info(
            "send_scheduled_email: %s already in status=%s, skipping",
            scheduled_email_id,
            email.status,
        )
        return f"skipped:{email.status}"

    if not email.to_email:
        _mark_failed(email, "Lead has no email address.")
        return "failed:no_recipient"

    # Resolve the SDR's Zoho credential via the lead's assigned_to user.
    from .models import UserEmailCredential
    credential = None
    lead = ScheduledEmail.objects.select_related(
        "lead__assigned_to"
    ).get(pk=scheduled_email_id).lead
    assigned = lead.assigned_to
    if assigned:
        credential = (
            UserEmailCredential.objects
            .filter(user=assigned, is_active=True)
            .first()
        )

    if not credential:
        _mark_failed(email, "Assigned SDR has no Zoho credential configured.")
        logger.error(
            "send_scheduled_email: no credential for lead %s (assigned_to=%s)",
            lead.pk, assigned,
        )
        return "failed:no_credential"

    try:
        _send_via_zoho(
            credential=credential,
            subject=email.subject_rendered,
            body_text=_html_to_plaintext(email.body_rendered),
            body_html=email.body_rendered,
            to_email=email.to_email,
            reply_to=credential.zoho_email,
        )

    except Exception as exc:
        logger.warning(
            "send_scheduled_email: delivery failed for %s — %s",
            scheduled_email_id,
            exc,
        )
        # Retry on transient errors; give up after max_retries.
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _mark_failed(email, str(exc))
            return "failed:max_retries"

    email.status = ScheduledEmail.Status.SENT
    email.sent_at = timezone.now()
    email.save(update_fields=["status", "sent_at"])

    logger.info(
        "send_scheduled_email: sent %s → %s (subject: %s)",
        scheduled_email_id,
        email.to_email,
        email.subject_rendered[:60],
    )
    return "sent"


# ─── Beat dispatcher task ────────────────────────────────────────────────────

@shared_task(name="emails.dispatch_due_emails")
def dispatch_due_emails() -> str:
    """Pick up all PENDING emails whose send_at has passed and dispatch them.

    Runs every 60 seconds via django-celery-beat (registered in Step 3.4).
    Uses select_for_update(skip_locked=True) so multiple beat workers can't
    double-dispatch the same row.
    """
    from .models import ScheduledEmail

    now = timezone.now()

    with __import__("django").db.transaction.atomic():
        due = (
            ScheduledEmail.objects
            .filter(status=ScheduledEmail.Status.PENDING, send_at__lte=now)
            .select_for_update(skip_locked=True)
            .values_list("id", flat=True)[:100]   # cap at 100 per tick
        )
        ids = list(due)

    for email_id in ids:
        send_scheduled_email.delay(str(email_id))

    if ids:
        logger.info("dispatch_due_emails: dispatched %d email(s)", len(ids))

    return f"dispatched:{len(ids)}"


# ─── IMAP inbox poller ───────────────────────────────────────────────────────

@shared_task(name="emails.poll_sdr_inboxes")
def poll_sdr_inboxes() -> str:
    """Poll every active SDR's Gmail inbox for replies from leads.

    Runs every 5 minutes via celery-beat. For each SDR credential:
      1. Connect to IMAP, fetch UNSEEN emails.
      2. Match the sender's email to a Lead in the CRM.
      3. Store as InboundEmail (deduplicated by Message-ID).
      4. Cancel all PENDING follow-up emails for that lead.
      5. Mark the IMAP message as SEEN so it isn't re-processed.
    """
    import email as email_lib
    import imaplib

    from leads.models import Lead
    from .models import InboundEmail, ScheduledEmail, UserEmailCredential

    credentials = UserEmailCredential.objects.filter(is_active=True).select_related("user")
    total_new = 0

    for cred in credentials:
        try:
            ctx = ssl.create_default_context(cafile=certifi.where())
            imap = imaplib.IMAP4_SSL(settings.IMAP_HOST, settings.IMAP_PORT, ssl_context=ctx)
            imap.login(cred.zoho_email, cred.app_password)
            imap.select("INBOX")

            # Search last 3 days instead of only UNSEEN — SDRs often open emails in
            # Gmail before the poller runs, which marks them SEEN and causes misses.
            # Message-ID deduplication in InboundEmail prevents re-processing.
            import datetime
            since_date = (timezone.now() - datetime.timedelta(days=3)).strftime("%d-%b-%Y")
            _, data = imap.search(None, f'SINCE {since_date}')
            msg_ids = data[0].split() if data[0] else []

            for num in msg_ids:
                _, msg_data = imap.fetch(num, "(RFC822)")
                raw = msg_data[0][1]
                msg = email_lib.message_from_bytes(raw)

                message_id = (msg.get("Message-ID") or "").strip()
                if not message_id:
                    continue

                # Deduplicate — skip if already stored.
                if InboundEmail.objects.filter(message_id=message_id).exists():
                    imap.store(num, "+FLAGS", "\\Seen")
                    continue

                from_header = msg.get("From", "")
                from_email = email_lib.utils.parseaddr(from_header)[1].lower()
                subject = msg.get("Subject", "")
                received_at = _parse_date(msg.get("Date"))

                # Extract plain-text body.
                body_text = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain" and not part.get("Content-Disposition"):
                            body_text = part.get_payload(decode=True).decode("utf-8", errors="replace")
                            break
                else:
                    body_text = msg.get_payload(decode=True).decode("utf-8", errors="replace")

                # Match to a lead by sender email.
                lead = Lead.objects.filter(email__iexact=from_email).first()

                InboundEmail.objects.create(
                    lead=lead,
                    from_email=from_email,
                    subject=subject,
                    body_text=body_text,
                    message_id=message_id,
                    received_at=received_at or timezone.now(),
                )
                total_new += 1

                # Auto-cancel pending follow-ups for this lead.
                if lead:
                    cancelled = (
                        ScheduledEmail.objects
                        .filter(lead=lead, status=ScheduledEmail.Status.PENDING)
                        .update(status=ScheduledEmail.Status.CANCELLED)
                    )
                    if cancelled:
                        logger.info(
                            "poll_sdr_inboxes: reply from %s → cancelled %d follow-up(s) for lead %s",
                            from_email, cancelled, lead.pk,
                        )

                imap.store(num, "+FLAGS", "\\Seen")

            imap.logout()

        except Exception as exc:
            logger.error("poll_sdr_inboxes: error polling %s — %s", cred.zoho_email, exc)

    if total_new:
        logger.info("poll_sdr_inboxes: stored %d new inbound email(s)", total_new)

    return f"inbound:{total_new}"


def _parse_date(date_str: str | None):
    """Parse an email Date header into a timezone-aware datetime."""
    if not date_str:
        return None
    import email.utils
    from datetime import datetime, timezone as dt_tz
    parsed = email.utils.parsedate_to_datetime(date_str)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_tz.utc)
    return parsed


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _mark_failed(email, reason: str) -> None:
    email.status = email.Status.FAILED
    email.error_message = reason
    email.save(update_fields=["status", "error_message"])
    logger.error(
        "send_scheduled_email: permanently failed %s — %s",
        email.pk,
        reason,
    )


def _html_to_plaintext(html: str) -> str:
    """Very simple HTML → plain-text fallback for email clients that prefer it."""
    import re
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<p[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()
