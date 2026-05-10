from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Lead, StatusHistory

# Sentinel attribute names used to pipe context (comment + actor) from the
# viewset/admin into the post_save handler. The viewset (Step 9) is expected
# to set these on the Lead instance before save:
#   lead._status_change_comment = "Spoke to assistant"
#   lead._status_changed_by     = request.user
# Admin saves don't set these; the row is still recorded with a blank
# comment and changed_by inferred from the request actor where possible.

_OLD_STATUS_ATTR = "_status_change_old"


@receiver(pre_save, sender=Lead)
def _capture_old_status(sender, instance: Lead, **kwargs):
    """Read the previous status from DB so post_save can compare."""
    if instance.pk is None:
        # New lead — no "previous" status. Initial NEW row is recorded
        # in post_save (created=True branch).
        setattr(instance, _OLD_STATUS_ATTR, None)
        return
    try:
        previous = Lead.objects.only("status").get(pk=instance.pk)
        setattr(instance, _OLD_STATUS_ATTR, previous.status)
    except Lead.DoesNotExist:
        setattr(instance, _OLD_STATUS_ATTR, None)


@receiver(post_save, sender=Lead)
def _record_status_change(sender, instance: Lead, created: bool, **kwargs):
    old_status = getattr(instance, _OLD_STATUS_ATTR, None)
    new_status = instance.status

    # Newly created lead: always log the initial status as a history row
    # so the timeline starts from the very first state.
    if created:
        StatusHistory.objects.create(
            lead=instance,
            from_status="",
            to_status=new_status,
            comment=getattr(instance, "_status_change_comment", "") or "",
            changed_by=getattr(instance, "_status_changed_by", None) or instance.created_by,
        )
        return

    # Existing lead: only log when status actually changed.
    if old_status is None or old_status == new_status:
        return

    StatusHistory.objects.create(
        lead=instance,
        from_status=old_status,
        to_status=new_status,
        comment=getattr(instance, "_status_change_comment", "") or "",
        changed_by=getattr(instance, "_status_changed_by", None),
    )
