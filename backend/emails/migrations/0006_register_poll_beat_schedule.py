from django.db import migrations


def register_poll_task(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = IntervalSchedule.objects.get_or_create(
        every=5,
        period="minutes",
    )
    PeriodicTask.objects.update_or_create(
        name="Poll SDR inboxes every 5 minutes",
        defaults={
            "task": "emails.poll_sdr_inboxes",
            "interval": schedule,
            "enabled": True,
        },
    )


def deregister_poll_task(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="Poll SDR inboxes every 5 minutes").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("emails", "0005_inboundemail"),
        ("django_celery_beat", "0018_improve_crontab_helptext"),
    ]

    operations = [
        migrations.RunPython(register_poll_task, deregister_poll_task),
    ]
