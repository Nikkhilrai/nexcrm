import uuid

from django.conf import settings
from django.db import models

from leads.models import Lead


class UserEmailCredential(models.Model):
    """Zoho email credentials for an SDR.

    One-to-one with User. When the system sends an email for a lead,
    it looks up the assigned SDR's credential and uses their Zoho
    account as the SMTP sender. IMAP polling uses these same credentials
    to read replies back from each SDR's inbox.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_credential",
    )
    zoho_email = models.EmailField(unique=True)
    app_password = models.CharField(
        max_length=255,
        help_text="Zoho App Password (generated at accounts.zoho.com → Security → App Passwords).",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("zoho_email",)

    def __str__(self) -> str:
        return f"{self.zoho_email} ({self.user.username})"


class InboundEmail(models.Model):
    """A reply received from a lead, detected by the IMAP poller.

    Matched to a lead by the sender's email address. When created, the
    auto-cancel signal fires and cancels all PENDING follow-ups for that lead.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="inbound_emails",
        null=True,
        blank=True,
        help_text="Matched lead. Null if no lead found with this sender email.",
    )
    from_email = models.EmailField(db_index=True)
    subject = models.CharField(max_length=500, blank=True)
    body_text = models.TextField(blank=True)
    message_id = models.CharField(
        max_length=500,
        unique=True,
        help_text="Email Message-ID header — used to deduplicate on re-poll.",
    )
    received_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-received_at",)
        indexes = [
            models.Index(fields=("lead", "-received_at")),
        ]

    def __str__(self) -> str:
        return f"From {self.from_email} — {self.subject[:60]}"


class EmailTemplate(models.Model):
    """Admin-created reusable email template with merge-tag support.

    Merge tags are double-brace tokens: {{lead_name}}, {{event_city}}, etc.
    The full list of supported tags is rendered by emails.utils.render_template().
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(
        max_length=150,
        unique=True,
        help_text="Internal label shown in dropdowns (e.g. 'Info Pack — Delegate').",
    )
    subject = models.CharField(
        max_length=300,
        help_text="Email subject line. Merge tags supported.",
    )
    body_html = models.TextField(
        help_text="Email body. Plain text or simple HTML. Merge tags supported.",
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_email_templates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class EmailRule(models.Model):
    """Trigger rule: when a lead moves to a given status, auto-queue an email.

    delay_hours=0 means "send on the next beat tick" (within ~60 seconds).
    Multiple rules can share the same trigger_status (e.g. send two emails
    when INFO_SENT — one immediately, one 24 h later).
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(
        max_length=150,
        help_text="Internal label (e.g. 'Info pack on INFO_SENT').",
    )
    trigger_status = models.CharField(
        max_length=24,
        choices=Lead.Status.choices,
        db_index=True,
        help_text="The lead status that fires this rule.",
    )
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.PROTECT,
        related_name="rules",
        help_text="Template to use when this rule fires.",
    )
    delay_hours = models.PositiveIntegerField(
        default=0,
        help_text="Hours after the status change before the email is sent. 0 = immediate.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("trigger_status", "delay_hours")

    def __str__(self) -> str:
        return f"{self.name} ({self.get_trigger_status_display()} +{self.delay_hours}h)"


class ScheduledEmail(models.Model):
    """A single outgoing email — both the queue entry and the sent record.

    The subject and body are rendered (merge tags resolved) at queue time and
    stored here. That way: editing a template later won't alter queued emails,
    and the sent record always shows exactly what was delivered.

    Lifecycle: PENDING → SENT (happy path)
               PENDING → FAILED (SMTP error; error_message populated)
               PENDING → CANCELLED (SDR cancelled before send_at)
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="scheduled_emails",
    )
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        related_name="scheduled_emails",
        help_text="Source template (kept for reference; rendered copies are stored below).",
    )

    # Rendered at queue time — immune to later template edits.
    subject_rendered = models.CharField(max_length=300)
    body_rendered = models.TextField()

    to_email = models.EmailField(
        help_text="Recipient address resolved at queue time from lead.email.",
    )
    # Resolved at queue time from lead.assigned_to.email (auto-sends) or
    # request.user.email (manual sends). Used as Reply-To so replies land in
    # the SDR's inbox, not the shared SMTP account.
    from_email = models.EmailField(
        blank=True,
        default="",
        help_text="SDR email set as Reply-To. Blank = fall back to DEFAULT_FROM_EMAIL.",
    )
    send_at = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(
        blank=True,
        help_text="Populated when status=FAILED.",
    )

    # Who triggered it: null = auto-triggered by a rule, set = manual SDR send.
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_emails",
    )
    # Which rule fired it (null for manual sends).
    rule = models.ForeignKey(
        EmailRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_emails",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "send_at")),
            models.Index(fields=("lead", "-created_at")),
        ]

    def __str__(self) -> str:
        return f"[{self.status}] {self.subject_rendered[:60]} → {self.to_email}"
