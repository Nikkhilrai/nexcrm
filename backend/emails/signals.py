from datetime import timedelta

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from leads.models import StatusHistory

from .models import EmailRule, ScheduledEmail
from .utils import build_context, render_template


@receiver(post_save, sender=StatusHistory)
def auto_queue_email_on_status_change(
    sender, instance: StatusHistory, created: bool, **kwargs
) -> None:
    """When a lead changes status, queue emails for every matching active rule.

    Only fires on newly created StatusHistory rows (i.e. real status changes).
    Skips leads with no email address — nothing to send to.
    Uses select_related so no extra queries per rule.
    """
    if not created:
        return

    rules = (
        EmailRule.objects
        .filter(trigger_status=instance.to_status, is_active=True)
        .select_related("template")
    )
    if not rules.exists():
        return

    lead = instance.lead
    if not lead.email:
        return  # Can't deliver without a recipient address.

    # Load related objects once (assigned_to needed for reply-to resolution).
    lead_with_relations = (
        type(lead).objects
        .select_related("event_interest", "sub_pipeline", "package_tier", "assigned_to")
        .get(pk=lead.pk)
    )

    # Resolve sender name and Reply-To email.
    # Priority: assigned SDR → status-change actor → generic team name.
    assigned = lead_with_relations.assigned_to
    changer = instance.changed_by

    if assigned and assigned.email:
        sender_name = assigned.get_full_name() or assigned.username
        reply_to_email = assigned.email
    elif changer and changer.email:
        sender_name = changer.get_full_name() or changer.username
        reply_to_email = changer.email
    else:
        sender_name = "LexTalk Team"
        reply_to_email = ""

    ctx = build_context(lead_with_relations, sender_name=sender_name)

    to_create = []
    for rule in rules:
        if not rule.template.is_active:
            continue

        send_at = timezone.now() + timedelta(hours=rule.delay_hours)

        to_create.append(
            ScheduledEmail(
                lead=lead,
                template=rule.template,
                subject_rendered=render_template(rule.template.subject, ctx),
                body_rendered=render_template(rule.template.body_html, ctx),
                to_email=lead.email,
                from_email=reply_to_email,
                send_at=send_at,
                triggered_by=instance.changed_by,
                rule=rule,
            )
        )

    if to_create:
        ScheduledEmail.objects.bulk_create(to_create)
