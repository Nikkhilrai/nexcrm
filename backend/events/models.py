from django.db import models


class Event(models.Model):
    """A LexTalk World conference. Leads carry an FK to one of these."""

    name = models.CharField(max_length=200)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive events are hidden from new-lead dropdowns but still attached to historical leads.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("start_date",)

    def __str__(self) -> str:
        return f"{self.name} ({self.city}, {self.start_date:%b %Y})"
