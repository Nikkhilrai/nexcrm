"""Seed realistic fake leads for the LexTalk World CRM.

Idempotent: deletes prior fake rows (phone prefix `+9170`) before creating.
The frontend uses this data to populate the master pipeline table, the
sub-pipeline kanban boards, filters, edit page, and admin dashboard.

Run order:
    python manage.py seed_events
    python manage.py seed_tiers   # required — leads pull tier from DB
    python manage.py seed_leads
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone

from accounts.models import User
from events.models import Event
from leads.models import Interaction, Lead, PackageTier, StatusHistory, SubPipeline

NAMES = [
    "Aanya Sharma", "Rohan Mehta", "Priya Iyer", "Karan Kapoor", "Neha Patel",
    "Arjun Singh", "Diya Reddy", "Vihaan Shah", "Ishita Khanna", "Aditya Joshi",
    "Anaya Gupta", "Reyansh Bose", "Saanvi Rao", "Krishna Nair", "Aarav Bhatia",
    "Sara Mathew", "Dhruv Pillai", "Riya Menon", "Vivaan Saxena", "Myra Verma",
    "Ananya Kulkarni", "Aaryan Chopra", "Tara Banerjee", "Kabir Desai",
    "Ahmed Al-Mansoori", "Fatima Al-Suwaidi", "Khalid Al-Maktoum", "Layla Al-Falasi",
    "James OBrien", "Sarah Mitchell", "Michael Chang", "Jennifer Hayes",
    "Ravi Krishnan", "Pooja Agarwal", "Sandeep Naidu", "Megha Pillai",
    "Yash Trivedi", "Aakash Choudhary", "Tanya Roy", "Shivani Bhalla",
    "Aditi Goswami", "Manish Sinha", "Pranav Bhatt", "Kritika Malhotra",
    "Rahul Khanna", "Suhana Singh", "Devika Iyer",
    "Naveen Reddy", "Ishaan Pradhan", "Ria Saxena",
]
COMPANIES = [
    "Sharma & Partners LLP", "Mehta Legal Associates", "Iyer Chambers",
    "Kapoor & Co.", "Patel Advisory", "Singh Legal Consultants",
    "Reddy & Reddy LLP", "Shah Law Group", "Khanna Legal", "Joshi Advocates",
    "ACME Pharma India", "Skyline Tech Solutions", "MetroBank Holdings",
    "BlueOcean Logistics", "Granite Construction Pvt Ltd", "Alpha Energy Corp",
    "Quantum Software", "Greenfield Realty", "NorthStar Capital",
    "Pinnacle Insurance", "Coastal Trading Co.", "Helix Biotech",
    "Vega Aerospace", "Orion Manufacturing", "Cipher Cybersecurity",
]
DESIGNATIONS = [
    "General Counsel", "Senior Partner", "Associate Partner", "Head of Legal",
    "Chief Legal Officer", "Legal Director", "Senior Advocate",
    "Compliance Head", "VP Legal", "Managing Partner",
]
LOCATIONS = [
    ("Mumbai", "India"), ("Delhi", "India"), ("Bangalore", "India"),
    ("Pune", "India"), ("Chennai", "India"), ("Hyderabad", "India"),
    ("Dubai", "UAE"), ("Abu Dhabi", "UAE"),
    ("Singapore", "Singapore"), ("London", "UK"), ("New York", "USA"),
]
OUTCOMES = [
    "Answered, asked for proposal", "Voicemail",
    "Asked to call back next week", "Sent materials",
    "No reply", "Forwarded to team", "Scheduled demo",
]

# Status weights → realistic CRM funnel (heavier at top, sparse at outcome).
STATUS_DISTRIBUTION = [
    (Lead.Status.LEAD_ASSIGNED,  0.20),
    (Lead.Status.CALL_CONNECTED, 0.18),
    (Lead.Status.INFO_SENT,      0.15),
    (Lead.Status.FOLLOWUP_1,     0.13),
    (Lead.Status.FOLLOWUP_2,     0.10),
    (Lead.Status.FOLLOWUP_3,     0.07),
    (Lead.Status.DEAL_WON,       0.08),
    (Lead.Status.DEAL_LOST,      0.05),
    (Lead.Status.DECLINED,       0.04),
]

# Linear path INTO each status (target inclusive). Terminal stages can land
# from anywhere mid-funnel; DECLINED is an early refusal so its path is short.
_LINEAR = [
    Lead.Status.LEAD_ASSIGNED,
    Lead.Status.CALL_CONNECTED,
    Lead.Status.INFO_SENT,
    Lead.Status.FOLLOWUP_1,
    Lead.Status.FOLLOWUP_2,
    Lead.Status.FOLLOWUP_3,
]

PATH_TO = {
    Lead.Status.LEAD_ASSIGNED:  [],
    Lead.Status.CALL_CONNECTED: _LINEAR[:1],
    Lead.Status.INFO_SENT:      _LINEAR[:2],
    Lead.Status.FOLLOWUP_1:     _LINEAR[:3],
    Lead.Status.FOLLOWUP_2:     _LINEAR[:4],
    Lead.Status.FOLLOWUP_3:     _LINEAR[:5],
    Lead.Status.DEAL_WON:       _LINEAR[:],
    Lead.Status.DEAL_LOST:      _LINEAR[:],
    Lead.Status.DECLINED:       _LINEAR[:2],   # short-circuit out after first contact
}

# Mid-funnel statuses (anything that's not terminal) — these get a future
# next_followup_at so the "Followups due" widget on the admin dashboard
# has something to count.
MID_FUNNEL = (
    Lead.Status.CALL_CONNECTED,
    Lead.Status.INFO_SENT,
    Lead.Status.FOLLOWUP_1,
    Lead.Status.FOLLOWUP_2,
    Lead.Status.FOLLOWUP_3,
)


def _pick_tier(rng, sub_pipeline_id, tiers_by_subpipeline):
    """Pick a random active tier for this sub-pipeline. Returns None if no
    tiers configured — Lead.package_tier is nullable so the row stays valid."""
    pool = tiers_by_subpipeline.get(sub_pipeline_id, [])
    return rng.choice(pool) if pool else None


def _pick_currency(rng, tier, event):
    """Return 'USD' ~20% of the time when the tier has a USD price and the
    event is Dubai (the client's only USD market). All other combos use INR."""
    if (
        tier
        and tier.default_price_usd is not None
        and tier.default_price_usd > 0
        and "dubai" in event.city.lower()
        and rng.random() < 0.20
    ):
        return Lead.Currency.USD
    return Lead.Currency.INR


def _deal_value_for(rng, tier, currency):
    """When a lead lands on DEAL_WON, fabricate a deal_value from the tier's
    price for the chosen currency ± 10% jitter. Falls back to hand-picked INR
    ranges when the tier has no price (in-kind / free slots)."""
    if currency == Lead.Currency.USD:
        base_price = tier.default_price_usd if tier else None
        fallback = ["200", "500", "1000", "2000", "5000"]
    else:
        base_price = tier.default_price_inr if tier else None
        fallback = ["25000", "50000", "75000", "100000", "150000"]

    if base_price and base_price > 0:
        base = float(base_price)
        jitter = rng.uniform(0.9, 1.1)
        return Decimal(int(base * jitter))
    return Decimal(rng.choice(fallback))


class Command(BaseCommand):
    help = "Seed realistic fake leads. Phone prefix +9170 — re-running clears prior fakes."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=50)

    def handle(self, *args, count, **options):
        random.seed(42)
        rng = random.Random(42)

        deleted, _ = Lead.objects.filter(phone__startswith="+9170").delete()
        if deleted:
            self.stdout.write(f"Cleared {deleted} prior fake row(s).")

        events = list(Event.objects.filter(is_active=True))
        callers = list(User.objects.filter(role=User.Role.USER, is_active=True))
        admin = User.objects.filter(role=User.Role.ADMIN).first()
        if not events or not callers:
            self.stderr.write(
                "Need at least 1 active Event and 1 active USER. "
                "Run `seed_events` and create at least one caller first."
            )
            return

        # Per-event pool of active sub-pipelines + per-sub-pipeline pool of
        # active tiers. Keep both bucketed so the inner loop is O(1).
        subpipelines_by_event: dict[int, list[SubPipeline]] = {}
        for sp in SubPipeline.objects.filter(is_active=True):
            subpipelines_by_event.setdefault(sp.event_id, []).append(sp)
        if not subpipelines_by_event:
            self.stderr.write(
                "No active SubPipeline rows found. Run `seed_tiers` first so "
                "leads can be assigned sub-pipelines."
            )
            return

        tiers_by_subpipeline: dict[int, list[PackageTier]] = {}
        for tier in PackageTier.objects.filter(is_active=True):
            tiers_by_subpipeline.setdefault(tier.sub_pipeline_id, []).append(tier)

        now = timezone.now()
        # Build a weighted-random pool for status picks.
        status_pool = []
        for s, w in STATUS_DISTRIBUTION:
            status_pool.extend([s] * int(round(w * 100)))

        leads_made = []
        for i in range(count):
            full_name = rng.choice(NAMES)
            company = rng.choice(COMPANIES)
            designation = rng.choice(DESIGNATIONS)
            city, country = rng.choice(LOCATIONS)
            event = rng.choice(events)
            assigned = rng.choice(callers + [None])
            actor = assigned or admin

            # Every 10th lead reuses prior phone — exercises the same-phone sidebar.
            if i and i % 10 == 0 and leads_made:
                phone = leads_made[-1].phone
            else:
                phone = f"+9170{i:08d}"

            email = full_name.lower().replace(" ", ".") + "@example.com"

            target = rng.choice(status_pool)
            # Sub-pipeline must belong to the chosen event — pick from this
            # event's pool. If the event has none seeded, fall back to any
            # active one (won't pass our validate() check, so just skip).
            event_pipelines = subpipelines_by_event.get(event.id) or []
            if not event_pipelines:
                continue
            sub_pipeline = rng.choice(event_pipelines)
            tier = _pick_tier(rng, sub_pipeline.id, tiers_by_subpipeline)
            source = rng.choice(list(Lead.Source))

            days_old = rng.randint(0, 30)
            seed_created_at = now - timedelta(
                days=days_old, hours=rng.randint(0, 23)
            )

            deal_currency = _pick_currency(rng, tier, event)

            lead = Lead(
                full_name=full_name,
                phone=phone,
                email=email,
                company=company,
                designation=designation,
                city=city,
                country=country,
                event_interest=event,
                sub_pipeline=sub_pipeline,
                package_tier=tier,
                source=source,
                assigned_to=assigned,
                created_by=actor,
                deal_currency=deal_currency,
            )
            lead._status_changed_by = actor
            lead.save()  # status defaults to LEAD_ASSIGNED; signal writes ∅→LEAD_ASSIGNED row

            # Backdate the lead's created_at + the auto-created initial history row.
            # Sync the in-memory instance so subsequent save()s don't overwrite
            # created_at with the original (NOW) value via the UPDATE query.
            Lead.objects.filter(pk=lead.pk).update(created_at=seed_created_at)
            StatusHistory.objects.filter(lead=lead).update(changed_at=seed_created_at)
            lead.created_at = seed_created_at

            # Walk through pipeline transitions toward `target`, advancing
            # the timestamp by 2–48h per hop. Each save fires the signal
            # which creates a StatusHistory row; we backdate that row
            # immediately afterwards.
            cursor_time = seed_created_at
            transitions = PATH_TO[target] + [target]  # path including target
            for next_status in transitions[1:]:  # skip LEAD_ASSIGNED (already saved)
                cursor_time += timedelta(hours=rng.randint(2, 48))
                if cursor_time > now:
                    break
                lead.status = next_status
                lead._status_change_comment = (
                    f"Moved to {Lead.Status(next_status).label}."
                )
                lead._status_changed_by = actor
                lead.save()
                StatusHistory.objects.filter(
                    lead=lead, to_status=next_status
                ).update(changed_at=cursor_time)

            # DEAL_WON leads get a deal_value derived from their tier price.
            if lead.status == Lead.Status.DEAL_WON:
                lead.deal_value = _deal_value_for(rng, tier, deal_currency)
                lead.save()

            # 1–3 interactions per lead, scattered between created_at and now.
            for _ in range(rng.randint(1, 3)):
                offset_seconds = rng.randint(
                    0, max(int((now - seed_created_at).total_seconds()), 3600)
                )
                Interaction.objects.create(
                    lead=lead,
                    user=actor,
                    type=rng.choice(list(Interaction.Type)),
                    outcome=rng.choice(OUTCOMES),
                    notes="",
                    occurred_at=seed_created_at + timedelta(seconds=offset_seconds),
                )

            # Mid-funnel leads get a next_followup_at in the near window.
            if lead.status in MID_FUNNEL:
                lead.next_followup_at = now + timedelta(hours=rng.randint(-48, 96))
                lead.save()

            leads_made.append(lead)

        # Stats summary
        self.stdout.write(
            self.style.SUCCESS(f"Created {len(leads_made)} fake leads.")
        )
        rows = (
            Lead.objects.filter(phone__startswith="+9170")
            .values("status")
            .annotate(c=Count("id"))
            .order_by("-c")
        )
        for r in rows:
            self.stdout.write(f"  {r['status']:18} {r['c']:>3}")
        self.stdout.write(
            f"Interactions: {Interaction.objects.filter(lead__phone__startswith='+9170').count()}"
        )
        self.stdout.write(
            f"Status history rows: "
            f"{StatusHistory.objects.filter(lead__phone__startswith='+9170').count()}"
        )
        self.stdout.write(
            f"Same-phone clusters: "
            f"{Lead.objects.filter(phone__startswith='+9170').values('phone').annotate(c=Count('id')).filter(c__gt=1).count()}"
        )
        # Sub-pipeline distribution — useful for kanban smoke testing
        self.stdout.write("Sub-pipeline breakdown:")
        for r in (
            Lead.objects.filter(phone__startswith="+9170")
            .values("sub_pipeline__event__city", "sub_pipeline__name")
            .annotate(c=Count("id"))
            .order_by("-c")
        ):
            label = f"{r['sub_pipeline__event__city']} — {r['sub_pipeline__name']}"
            self.stdout.write(f"  {label:40} {r['c']:>3}")
