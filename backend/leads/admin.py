from django.contrib import admin

from .models import Contact, Interaction, Lead, PackageTier, StatusHistory, SubPipeline


class InteractionInline(admin.TabularInline):
    model = Interaction
    extra = 0
    fields = ("type", "occurred_at", "user", "outcome", "notes")
    readonly_fields = ("created_at",)
    ordering = ("-occurred_at",)


class StatusHistoryInline(admin.TabularInline):
    model = StatusHistory
    extra = 0
    fields = ("from_status", "to_status", "comment", "changed_by", "changed_at")
    readonly_fields = ("from_status", "to_status", "changed_at")
    ordering = ("-changed_at",)
    can_delete = False


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "phone",
        "company",
        "event_interest",
        "sub_pipeline",
        "package_tier",
        "status",
        "assigned_to",
        "next_followup_at",
        "created_at",
    )
    list_filter = (
        "status",
        "event_interest",
        "sub_pipeline",
        "package_tier",
        "source",
        "assigned_to",
    )
    search_fields = ("full_name", "phone", "email", "company")
    readonly_fields = ("id", "created_at", "updated_at", "created_by")
    autocomplete_fields = ("assigned_to", "package_tier", "sub_pipeline")
    inlines = (InteractionInline, StatusHistoryInline)

    fieldsets = (
        ("Contact", {
            "fields": ("full_name", "email", "phone", "company", "designation",
                       "linkedin_url", "city", "country"),
        }),
        ("Pipeline", {
            "fields": ("event_interest", "sub_pipeline", "package_tier",
                       "source", "status", "assigned_to", "next_followup_at",
                       "deal_value", "deal_currency", "notes"),
        }),
        ("Audit", {
            "fields": ("id", "created_by", "created_at", "updated_at"),
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        # Pipe actor through to the signal so admin status changes are attributed.
        obj._status_changed_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ("lead", "type", "user", "occurred_at", "outcome")
    list_filter = ("type",)
    search_fields = ("lead__full_name", "outcome", "notes")


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("lead", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("lead__full_name", "comment")
    readonly_fields = ("lead", "from_status", "to_status", "changed_by", "changed_at")


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "email", "company", "designation", "source", "created_at")
    list_filter = ("source",)
    search_fields = ("full_name", "phone", "email", "company")
    readonly_fields = ("created_by", "created_at", "updated_at")


@admin.register(SubPipeline)
class SubPipelineAdmin(admin.ModelAdmin):
    list_display = ("event", "name", "slug", "is_active", "sort_order")
    list_filter = ("event", "is_active")
    search_fields = ("name", "slug")
    list_editable = ("is_active", "sort_order")
    ordering = ("event_id", "sort_order", "name")
    autocomplete_fields = ("event",)


@admin.register(PackageTier)
class PackageTierAdmin(admin.ModelAdmin):
    list_display = (
        "sub_pipeline",
        "name",
        "default_price_inr",
        "default_price_usd",
        "is_active",
        "sort_order",
    )
    list_filter = ("sub_pipeline__event", "sub_pipeline", "is_active")
    search_fields = ("name", "sub_pipeline__name")
    list_editable = ("default_price_inr", "default_price_usd", "is_active", "sort_order")
    ordering = ("sub_pipeline__event_id", "sub_pipeline__sort_order", "sort_order", "name")
    autocomplete_fields = ("sub_pipeline",)
