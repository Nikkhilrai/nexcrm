import uuid

from django.conf import settings
from django.db import models


class SubPipeline(models.Model):
    """Admin-defined sub-pipeline scoped to a specific Event.

    Replaces the old `Lead.ProductInterest` enum (Phase 2.9). Each event has
    its own list of sub-pipelines (Sponsors / Speakers / etc.) so adding a
    new event lets the admin define fresh categories without a code change.
    Tiers (`PackageTier`) and leads (`Lead`) attach to a SubPipeline row.
    """

    id = models.BigAutoField(primary_key=True)
    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="sub_pipelines",
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(
        max_length=120,
        help_text="URL-safe identifier, auto-derived from the name within the event scope.",
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("event_id", "sort_order", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("event", "name"),
                name="uniq_subpipeline_per_event_name",
            ),
            models.UniqueConstraint(
                fields=("event", "slug"),
                name="uniq_subpipeline_per_event_slug",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event.city} — {self.name}"


class Lead(models.Model):
    """A sales prospect for one specific event.

    Same person interested in two events = two Lead rows. The same-phone
    sidebar in the UI surfaces them together.
    """

    class Source(models.TextChoices):
        WEBSITE_FORM = "WEBSITE_FORM", "Website Form"
        LINKEDIN = "LINKEDIN", "LinkedIn"
        REFERRAL = "REFERRAL", "Referral"
        COLD_CALL = "COLD_CALL", "Cold Call"
        EMAIL = "EMAIL", "Email"
        OTHER = "OTHER", "Other"

    class Currency(models.TextChoices):
        INR = "INR", "Indian Rupee (₹)"
        USD = "USD", "US Dollar ($)"

    class Status(models.TextChoices):
        LEAD_ASSIGNED = "LEAD_ASSIGNED", "Lead Assigned"
        NOT_CONNECTED = "NOT_CONNECTED", "Not Connected"
        CALL_CONNECTED = "CALL_CONNECTED", "Call Connected"
        CALL_SCHEDULE = "CALL_SCHEDULE", "Call Schedule"
        INFO_SENT = "INFO_SENT", "Info Sent"
        FORM_SENT = "FORM_SENT", "Form Sent"
        PROPOSAL_SENT = "PROPOSAL_SENT", "Proposal Sent"
        FOLLOWUP_1 = "FOLLOWUP_1", "Follow-Up 1"
        FOLLOWUP_2 = "FOLLOWUP_2", "Follow-Up 2"
        FOLLOWUP_3 = "FOLLOWUP_3", "Follow-Up 3"
        INVOICE_SENT = "INVOICE_SENT", "Invoice Sent"
        DEAL_WON = "DEAL_WON", "Deal Won"
        DEAL_LOST = "DEAL_LOST", "Deal Lost"
        DECLINED = "DECLINED", "Declined"
        NOT_QUALIFIED = "NOT_QUALIFIED", "Not Qualified"
        FORM_RECEIVED = "FORM_RECEIVED", "Form Received"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Contact
    full_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True, db_index=True)
    company = models.CharField(max_length=200, blank=True)
    designation = models.CharField(max_length=200, blank=True)
    linkedin_url = models.URLField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)

    # Pipeline
    event_interest = models.ForeignKey(
        "events.Event",
        on_delete=models.PROTECT,
        related_name="leads",
    )
    sub_pipeline = models.ForeignKey(
        "leads.SubPipeline",
        on_delete=models.PROTECT,
        related_name="leads",
        help_text="Per-event sub-pipeline (Sponsors, Speakers, etc.). Replaced "
                  "the old product_interest enum in Phase 2.9.",
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.OTHER,
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.LEAD_ASSIGNED,
        db_index=True,
    )
    package_tier = models.ForeignKey(
        "leads.PackageTier",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="leads",
        help_text="Tier within the sub-pipeline (e.g. Platinum sponsor, VIP delegate). Choices filtered by product_interest.",
    )

    # Ownership + scheduling
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads",
    )
    next_followup_at = models.DateTimeField(null=True, blank=True)
    deal_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Filled when status moves to WON / payment received.",
    )
    deal_currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.INR,
        help_text=(
            "Currency the deal_value was negotiated in. Each deal carries one "
            "currency; tiers can advertise both ₹ and $ prices."
        ),
    )
    category = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    # Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_leads",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "event_interest")),
            models.Index(fields=("assigned_to", "-created_at")),
            models.Index(fields=("sub_pipeline", "-created_at")),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.phone}) — {self.event_interest.city}"


class PackageTier(models.Model):
    """A purchasable tier within a sub-pipeline (e.g. Platinum sponsor, VIP delegate).

    Admin-editable so the client can adjust tiers + default prices without code changes.
    """

    id = models.BigAutoField(primary_key=True)
    sub_pipeline = models.ForeignKey(
        "leads.SubPipeline",
        on_delete=models.CASCADE,
        related_name="tiers",
    )
    name = models.CharField(max_length=80)
    default_price_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Suggested deal_value (₹) when a lead in this tier converts.",
    )
    default_price_usd = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Suggested deal_value ($) when a lead in this tier converts.",
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sub_pipeline_id", "sort_order", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("sub_pipeline", "name"),
                name="uniq_tier_per_subpipeline",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sub_pipeline} — {self.name}"


class Contact(models.Model):
    """A reusable contact record for the client's contacts database.

    Populated via admin Excel upload and auto-created when a Lead is saved with
    a previously-unseen phone. Phone is the unique key. Lead does NOT FK into
    this model — the Lead form picker copies these fields onto the Lead at
    creation time (snapshot semantics).
    """

    id = models.BigAutoField(primary_key=True)
    full_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=32, blank=True, db_index=True)
    email = models.EmailField(blank=True, null=True, unique=True)
    company = models.CharField(max_length=200, blank=True)
    designation = models.CharField(max_length=200, blank=True)
    linkedin_url = models.URLField(blank=True)
    source = models.CharField(
        max_length=20,
        choices=Lead.Source.choices,
        default=Lead.Source.OTHER,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_contacts",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.full_name or '(unnamed)'} — {self.phone}"


class Interaction(models.Model):
    """Log of every touchpoint a user has with a lead."""

    class Type(models.TextChoices):
        CALL = "CALL", "Call"
        EMAIL = "EMAIL", "Email"
        LINKEDIN = "LINKEDIN", "LinkedIn"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        MEETING = "MEETING", "Meeting"
        NOTE = "NOTE", "Note"

    id = models.BigAutoField(primary_key=True)
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="interactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="interactions",
    )
    type = models.CharField(max_length=12, choices=Type.choices)
    outcome = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    occurred_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-occurred_at",)
        indexes = [models.Index(fields=("lead", "-occurred_at"))]

    def __str__(self) -> str:
        return f"{self.get_type_display()} on {self.lead.full_name} @ {self.occurred_at:%Y-%m-%d %H:%M}"


class StatusHistory(models.Model):
    """One row per Lead.status change. Auto-created by signal."""

    id = models.BigAutoField(primary_key=True)
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24)
    comment = models.TextField(
        blank=True,
        help_text="Why the status changed. Required when set via API; may be blank for admin/system changes.",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="status_changes",
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-changed_at",)
        indexes = [models.Index(fields=("lead", "-changed_at"))]
        verbose_name_plural = "Status history"

    def __str__(self) -> str:
        return f"{self.from_status or '∅'} → {self.to_status} on {self.lead.full_name}"
