from django.db import migrations


def wipe_for_phase_2_9(apps, schema_editor):
    """Phase 2.9 cut-over: `product_interest` enum on Lead + PackageTier is
    being replaced with a `sub_pipeline` FK. The next migration drops the
    enum field; existing PackageTier rows hold soon-to-be-invalid values and
    Lead rows would also lose their pipeline classification. All current
    data is dummy seed data (user re-confirmed before cut-over) so we wipe
    leads and tiers here. seed_tiers + seed_leads repopulate after migrate.

    Order matters: Lead.package_tier is on_delete=PROTECT, so leads must be
    deleted first or the tier wipe would error.

    Same two-migration split as Phase 2.5 (cf. 0002_wipe_dummy_leads) — keeps
    the wipe and the schema rewrite in separate transactions, dodging
    Postgres "pending trigger events" errors.
    """
    Lead = apps.get_model("leads", "Lead")
    PackageTier = apps.get_model("leads", "PackageTier")
    Lead.objects.all().delete()
    PackageTier.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0005_subpipeline"),
    ]

    operations = [
        migrations.RunPython(wipe_for_phase_2_9, reverse_code=migrations.RunPython.noop),
    ]
