from datetime import date

from django.core.management.base import BaseCommand

from events.models import Event

# Confirmed from lextalkworld.in research.
SEED_EVENTS = [
    {
        "name": "LexTalk World Bangalore 2026",
        "city": "Bangalore",
        "country": "India",
        "start_date": date(2026, 6, 11),
        "end_date": date(2026, 6, 11),
        "is_active": True,
    },
    {
        "name": "LexTalk World Dubai 2026",
        "city": "Dubai",
        "country": "United Arab Emirates",
        "start_date": date(2026, 9, 9),
        "end_date": date(2026, 9, 10),
        "is_active": True,
    },
    {
        "name": "LexTalk World Mumbai 2026",
        "city": "Mumbai",
        "country": "India",
        "start_date": date(2026, 12, 10),
        "end_date": date(2026, 12, 11),
        "is_active": True,
    },
]


class Command(BaseCommand):
    help = "Seed the three confirmed 2026 LexTalk World events. Idempotent."

    def handle(self, *args, **options):
        for data in SEED_EVENTS:
            event, created = Event.objects.update_or_create(
                name=data["name"],
                defaults=data,
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(f"  {verb}: {event}")

        total = Event.objects.count()
        self.stdout.write(self.style.SUCCESS(f"Done. {total} event(s) in DB."))
