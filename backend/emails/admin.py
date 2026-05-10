from django.contrib import admin

from .models import EmailRule, EmailTemplate, ScheduledEmail


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "subject", "is_active", "created_at")
    list_editable = ("is_active",)
    search_fields = ("name", "subject")
    readonly_fields = ("created_at", "updated_at", "created_by")

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(EmailRule)
class EmailRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "trigger_status", "template", "delay_hours", "is_active")
    list_editable = ("is_active",)
    list_filter = ("trigger_status", "is_active")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(ScheduledEmail)
class ScheduledEmailAdmin(admin.ModelAdmin):
    list_display = ("subject_rendered", "to_email", "lead", "status", "send_at", "sent_at")
    list_filter = ("status",)
    search_fields = ("to_email", "subject_rendered", "lead__full_name")
    readonly_fields = (
        "id", "lead", "template", "rule", "triggered_by",
        "subject_rendered", "body_rendered", "to_email",
        "send_at", "status", "sent_at", "error_message", "created_at",
    )

    def has_add_permission(self, request):
        return False  # Always created via API or signal, never manually.
