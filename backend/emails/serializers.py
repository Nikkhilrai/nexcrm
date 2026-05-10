from django.utils import timezone
from rest_framework import serializers

from leads.models import Lead

from .models import EmailRule, EmailTemplate, InboundEmail, ScheduledEmail, UserEmailCredential
from .utils import build_context, render_template


class EmailTemplateSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None
    )
    rules_count = serializers.SerializerMethodField()

    class Meta:
        model = EmailTemplate
        fields = [
            "id", "name", "subject", "body_html", "is_active",
            "rules_count", "created_by_username", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by_username", "rules_count", "created_at", "updated_at"]

    def get_rules_count(self, obj) -> int:
        return obj.rules.filter(is_active=True).count()

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["created_by"] = request.user if request else None
        return super().create(validated_data)


class EmailRuleSerializer(serializers.ModelSerializer):
    trigger_status_display = serializers.CharField(
        source="get_trigger_status_display", read_only=True
    )
    template_name = serializers.CharField(source="template.name", read_only=True)

    class Meta:
        model = EmailRule
        fields = [
            "id", "name", "trigger_status", "trigger_status_display",
            "template", "template_name", "delay_hours", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "trigger_status_display", "template_name", "created_at", "updated_at"]


class ScheduledEmailSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True, default=None)
    triggered_by_username = serializers.CharField(
        source="triggered_by.username", read_only=True, default=None
    )
    rule_name = serializers.CharField(source="rule.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ScheduledEmail
        fields = [
            "id", "template", "template_name",
            "subject_rendered", "body_rendered", "to_email", "from_email",
            "send_at", "status", "status_display", "sent_at", "error_message",
            "triggered_by", "triggered_by_username",
            "rule", "rule_name",
            "created_at",
        ]
        read_only_fields = fields  # always read-only; creation handled by create view


class ScheduledEmailCreateSerializer(serializers.Serializer):
    """Payload for POST /api/leads/{id}/emails/ (manual send by SDR)."""

    template_id = serializers.PrimaryKeyRelatedField(
        queryset=EmailTemplate.objects.filter(is_active=True),
        source="template",
    )
    delay_hours = serializers.IntegerField(min_value=0, max_value=168, default=0)

    def validate(self, attrs):
        lead: Lead = self.context["lead"]
        if not lead.email:
            raise serializers.ValidationError(
                {"template_id": "This lead has no email address — cannot send."}
            )
        return attrs

    def create_scheduled_email(self, lead: Lead, user) -> ScheduledEmail:
        template: EmailTemplate = self.validated_data["template"]
        delay_hours: int = self.validated_data["delay_hours"]

        sender_name = user.get_full_name() or user.username
        ctx = build_context(lead, sender_name=sender_name)
        send_at = timezone.now() + __import__("datetime").timedelta(hours=delay_hours)

        return ScheduledEmail.objects.create(
            lead=lead,
            template=template,
            subject_rendered=render_template(template.subject, ctx),
            body_rendered=render_template(template.body_html, ctx),
            to_email=lead.email,
            from_email=user.email or "",
            send_at=send_at,
            triggered_by=user,
            rule=None,
        )


class InboundEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = InboundEmail
        fields = ["id", "from_email", "subject", "body_text", "received_at", "created_at"]
        read_only_fields = fields


class EmailThreadItemSerializer(serializers.Serializer):
    """Unified outbound + inbound email thread item for the lead sidebar."""

    id = serializers.CharField()
    direction = serializers.CharField()   # "outbound" | "inbound"
    timestamp = serializers.DateTimeField()
    subject = serializers.CharField()
    body = serializers.CharField()
    from_email = serializers.CharField()
    to_email = serializers.CharField(allow_null=True)
    # outbound-only fields
    status = serializers.CharField(allow_null=True)
    template_name = serializers.CharField(allow_null=True)
    triggered_by_username = serializers.CharField(allow_null=True)
    rule_name = serializers.CharField(allow_null=True)

    @staticmethod
    def from_scheduled(email: ScheduledEmail) -> dict:
        return {
            "id": str(email.id),
            "direction": "outbound",
            "timestamp": email.sent_at or email.send_at,
            "subject": email.subject_rendered,
            "body": email.body_rendered,
            "from_email": email.from_email or "",
            "to_email": email.to_email,
            "status": email.status,
            "template_name": email.template.name if email.template_id else None,
            "triggered_by_username": email.triggered_by.username if email.triggered_by_id else None,
            "rule_name": email.rule.name if email.rule_id else None,
        }

    @staticmethod
    def from_inbound(email: InboundEmail) -> dict:
        return {
            "id": str(email.id),
            "direction": "inbound",
            "timestamp": email.received_at,
            "subject": email.subject,
            "body": email.body_text,
            "from_email": email.from_email,
            "to_email": None,
            "status": None,
            "template_name": None,
            "triggered_by_username": None,
            "rule_name": None,
        }


class UserEmailCredentialSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = UserEmailCredential
        fields = ["id", "username", "zoho_email", "app_password", "is_active", "updated_at"]
        read_only_fields = ["id", "username", "updated_at"]
        extra_kwargs = {"app_password": {"write_only": True}}


class AdminEmailQueueSerializer(serializers.ModelSerializer):
    """Flat row for the admin email-queue view — includes lead + SDR context."""

    template_name = serializers.CharField(source="template.name", read_only=True, default=None)
    triggered_by_username = serializers.CharField(source="triggered_by.username", read_only=True, default=None)
    rule_name = serializers.CharField(source="rule.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    lead_id = serializers.UUIDField(source="lead.id", read_only=True)
    lead_name = serializers.CharField(source="lead.full_name", read_only=True)
    lead_company = serializers.CharField(source="lead.company", read_only=True)

    assigned_to_username = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    def get_assigned_to_username(self, obj) -> str | None:
        u = obj.lead.assigned_to
        return u.username if u else None

    def get_assigned_to_name(self, obj) -> str | None:
        u = obj.lead.assigned_to
        if not u:
            return None
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    has_reply = serializers.BooleanField(read_only=True)
    latest_reply_at = serializers.DateTimeField(read_only=True, allow_null=True)
    latest_reply_subject = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = ScheduledEmail
        fields = [
            "id",
            "lead_id", "lead_name", "lead_company",
            "assigned_to_username", "assigned_to_name",
            "template_name", "subject_rendered",
            "to_email", "from_email",
            "send_at", "status", "status_display", "sent_at", "error_message",
            "triggered_by_username", "rule_name",
            "has_reply", "latest_reply_at", "latest_reply_subject",
            "created_at",
        ]
        read_only_fields = fields


class EmailTemplatePreviewSerializer(serializers.Serializer):
    """Payload for POST /api/email-templates/{id}/preview/."""

    lead_id = serializers.UUIDField()

    def validate_lead_id(self, value):
        try:
            return Lead.objects.select_related(
                "event_interest", "sub_pipeline", "package_tier"
            ).get(pk=value)
        except Lead.DoesNotExist:
            raise serializers.ValidationError("Lead not found.")
