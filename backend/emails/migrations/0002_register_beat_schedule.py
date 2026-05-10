"""Register the dispatch_due_emails periodic task in django-celery-beat.

Runs on every migrate so a fresh DB always has the beat entry without any
manual admin-panel clicking.
"""

from django.db import migrations


def register_beat_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = IntervalSchedule.objects.get_or_create(
        every=60,
        period="seconds",
    )

    PeriodicTask.objects.update_or_create(
        name="Dispatch due emails every 60 s",
        defaults={
            "task": "emails.dispatch_due_emails",
            "interval": schedule,
            "enabled": True,
        },
    )


def deregister_beat_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="Dispatch due emails every 60 s").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("emails", "0001_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(register_beat_schedule, deregister_beat_schedule),
    ]
