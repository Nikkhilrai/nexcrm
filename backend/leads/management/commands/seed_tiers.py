"""Seed default SubPipelines + PackageTiers for every active Event.

Idempotent — safe to re-run. Uses update_or_create keyed on the unique
constraints so neither (event, name) on SubPipeline nor (sub_pipeline, name)
on PackageTier ever trips.

Phase 2.9 reshaped this: SubPipelines are now per-event, not a hardcoded
enum. We seed the same 5 default categories for each active event so the
client gets a usable starting point. Admin can rename / disable / add /
delete from /admin/pipelines later.

Phase 2.10 adds default_price_usd alongside default_price_inr. USD prices
apply mainly to Sponsors and Delegate Passes (Dubai-oriented).

Defaults are derived from lextalkworld.in's public sponsor + delegate
pages (Platinum / Diamond / Gold tiers, "Knowledge Partner" callout,
delegate "VIP Networking & Awards Gala" copy). Prices are placeholders
and should be confirmed with the client before going live.

Run order:
    python manage.py seed_events
    python manage.py seed_tiers   # required — leads pull tier from DB
    python manage.py seed_leads
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from events.models import Event
from leads.models import PackageTier, SubPipeline


# Sub-pipeline name → list of (tier-name, price_inr, price_usd, sort_order).
# None means the column stays NULL (in-kind / free / TBD).
DEFAULT_PIPELINES: list[tuple[str, int, list[tuple[str, Decimal | None, Decimal | None, int]]]] = [
    (
        "Delegate Passes",
        10,
        [
            ("Standard Pass",       Decimal("25000"),  Decimal("300"),  10),
            ("VIP Pass",            Decimal("75000"),  Decimal("900"),  20),
            ("Group Pass (3+)",     None,              None,            30),
            ("Virtual Pass",        Decimal("10000"),  Decimal("120"),  40),
        ],
    ),
    (
        "Sponsors",
        20,
        [
            ("Platinum Sponsor",    Decimal("2000000"), Decimal("25000"), 10),
            ("Diamond Sponsor",     Decimal("1000000"), Decimal("12000"), 20),
            ("Gold Sponsor",        Decimal("500000"),  Decimal("6000"),  30),
            ("Knowledge Partner",   None,               None,             40),
        ],
    ),
    (
        "Speakers",
        30,
        [
            ("Keynote Speaker",     Decimal("0"), None, 10),
            ("Panelist",            Decimal("0"), None, 20),
            ("Moderator",           Decimal("0"), None, 30),
            ("Judge",               Decimal("0"), None, 40),
        ],
    ),
    (
        "Awardees",
        40,
        [
            ("GC of the Year",          Decimal("0"), None, 10),
            ("Legal Innovator",         Decimal("0"), None, 20),
            ("Rising Star",             Decimal("0"), None, 30),
            ("Lifetime Achievement",    Decimal("0"), None, 40),
            ("Firm of the Year",        Decimal("0"), None, 50),
        ],
    ),
    (
        "VIP / Media Partners",
        50,
        [
            ("Media Partner",       None, None, 10),
            ("Association Partner", None, None, 20),
            ("Bar Council",         None, None, 30),
            ("Government Body",     None, None, 40),
        ],
    ),
]


class Command(BaseCommand):
    help = (
        "Seed default sub-pipelines + tiers under every active Event. "
        "Idempotent."
    )

    def handle(self, *args, **options):
        events = list(Event.objects.filter(is_active=True))
        if not events:
            self.stderr.write(
                "No active Event rows found. Run `seed_events` first."
            )
            return

        sp_created = sp_updated = 0
        tier_created = tier_updated = 0

        for event in events:
            for sp_name, sp_order, tiers in DEFAULT_PIPELINES:
                sp, was_created = SubPipeline.objects.update_or_create(
                    event=event,
                    name=sp_name,
                    defaults={
                        "slug": slugify(sp_name),
                        "sort_order": sp_order,
                        "is_active": True,
                    },
                )
                if was_created:
                    sp_created += 1
                else:
                    sp_updated += 1

                for tier_name, price_inr, price_usd, order in tiers:
                    _, was_t_created = PackageTier.objects.update_or_create(
                        sub_pipeline=sp,
                        name=tier_name,
                        defaults={
                            "default_price_inr": price_inr,
                            "default_price_usd": price_usd,
                            "sort_order": order,
                            "is_active": True,
                        },
                    )
                    if was_t_created:
                        tier_created += 1
                    else:
                        tier_updated += 1

        sp_total = SubPipeline.objects.count()
        tier_total = PackageTier.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Sub-pipelines: created {sp_created}, refreshed {sp_updated} — "
                f"{sp_total} total. "
                f"Tiers: created {tier_created}, refreshed {tier_updated} — "
                f"{tier_total} total."
            )
        )
