from django.db import migrations


def wipe_dummy_leads(apps, schema_editor):
    """Phase 2.5 restructure: status + product_interest enums are being rewritten
    in 0003. Existing rows hold values that are about to become invalid choices.
    All current data is dummy seed data — wipe Leads (cascades to Interaction +
    StatusHistory) before flipping the enums. seed_leads + seed_tiers will repopulate."""
    Lead = apps.get_model("leads", "Lead")
    Lead.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(wipe_dummy_leads, reverse_code=migrations.RunPython.noop),
    ]
