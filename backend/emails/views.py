from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from leads.models import Lead

from .models import EmailRule, EmailTemplate, InboundEmail, ScheduledEmail, UserEmailCredential
from .serializers import (
    AdminEmailQueueSerializer,
    EmailRuleSerializer,
    EmailTemplatePreviewSerializer,
    EmailTemplateSerializer,
    EmailThreadItemSerializer,
    InboundEmailSerializer,
    ScheduledEmailCreateSerializer,
    ScheduledEmailSerializer,
    UserEmailCredentialSerializer,
)
from .utils import build_context, render_template


# ─── Email Templates ─────────────────────────────────────────────────────────

class EmailTemplateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for email templates. Read = any auth; write = admin only."""

    serializer_class = EmailTemplateSerializer
    pagination_class = None  # small reference set — no pagination needed
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = EmailTemplate.objects.select_related("created_by")
        if self.request.query_params.get("active_only") == "true":
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return super().get_permissions()  # IsAuthenticated default
        return [IsAdmin()]

    def destroy(self, request, *args, **kwargs):
        template = self.get_object()
        if template.rules.filter(is_active=True).exists():
            return Response(
                {"detail": "This template has active rules. Deactivate those rules first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="preview", permission_classes=[IsAdmin])
    def preview(self, request, pk=None):
        """POST /api/email-templates/{id}/preview/  body: {lead_id}
        Returns the rendered subject and body for a specific lead.
        """
        template = self.get_object()
        ser = EmailTemplatePreviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        lead = ser.validated_data["lead_id"]  # already fetched in validate_lead_id
        sender_name = request.user.get_full_name() or request.user.username
        ctx = build_context(lead, sender_name=sender_name)

        return Response({
            "subject": render_template(template.subject, ctx),
            "body_html": render_template(template.body_html, ctx),
            "lead_name": lead.full_name,
        })


# ─── Email Rules ─────────────────────────────────────────────────────────────

class EmailRuleViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for email trigger rules. Read = any auth; write = admin only."""

    serializer_class = EmailRuleSerializer
    pagination_class = None  # small reference set — no pagination needed
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = EmailRule.objects.select_related("template")
        trigger = self.request.query_params.get("trigger_status")
        if trigger:
            qs = qs.filter(trigger_status=trigger)
        if self.request.query_params.get("active_only") == "true":
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return super().get_permissions()
        return [IsAdmin()]

    def destroy(self, request, *args, **kwargs):
        rule = self.get_object()
        pending = rule.scheduled_emails.filter(
            status=ScheduledEmail.Status.PENDING
        ).count()
        if pending:
            return Response(
                {
                    "detail": (
                        f"This rule has {pending} pending email(s) in the queue. "
                        "Cancel or wait for them to send before deleting the rule."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ─── Per-lead email queue ─────────────────────────────────────────────────────

class LeadEmailViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Nested under /api/leads/{lead_pk}/emails/.

    GET  → list all scheduled/sent emails for this lead.
    POST → manually queue an email (SDR picks template + optional delay).
    POST /{id}/cancel/ → cancel a PENDING email.
    """

    pagination_class = None
    http_method_names = ["get", "post", "head", "options"]

    def _get_lead(self):
        try:
            return Lead.objects.select_related(
                "event_interest", "sub_pipeline", "package_tier"
            ).get(pk=self.kwargs["lead_pk"])
        except Lead.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Lead not found.")

    def get_queryset(self):
        return (
            ScheduledEmail.objects
            .filter(lead_id=self.kwargs["lead_pk"])
            .select_related("template", "triggered_by", "rule")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.request.method == "POST" and self.action == "create":
            return ScheduledEmailCreateSerializer
        return ScheduledEmailSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.method == "POST":
            ctx["lead"] = self._get_lead()
        return ctx

    def create(self, request, *args, **kwargs):
        lead = self._get_lead()
        ser = ScheduledEmailCreateSerializer(
            data=request.data,
            context={"request": request, "lead": lead},
        )
        ser.is_valid(raise_exception=True)
        scheduled = ser.create_scheduled_email(lead=lead, user=request.user)
        return Response(
            ScheduledEmailSerializer(scheduled).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, lead_pk=None, pk=None):
        """POST /api/leads/{lead_pk}/emails/{id}/cancel/
        Cancels a PENDING email. No-op if already sent/failed/cancelled.
        """
        try:
            email = ScheduledEmail.objects.get(pk=pk, lead_id=lead_pk)
        except ScheduledEmail.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if email.status != ScheduledEmail.Status.PENDING:
            return Response(
                {"detail": f"Cannot cancel — email is already {email.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email.status = ScheduledEmail.Status.CANCELLED
        email.save(update_fields=["status"])
        return Response(ScheduledEmailSerializer(email).data)

    @action(detail=False, methods=["get"], url_path="thread")
    def thread(self, request, lead_pk=None):
        """GET /api/leads/{lead_pk}/emails/thread/

        Returns outbound (ScheduledEmail) and inbound (InboundEmail) combined,
        sorted by timestamp descending — drives the unified email thread UI.
        """
        outbound = (
            ScheduledEmail.objects
            .filter(lead_id=lead_pk)
            .select_related("template", "triggered_by", "rule")
            .order_by("-created_at")
        )
        inbound = (
            InboundEmail.objects
            .filter(lead_id=lead_pk)
            .order_by("-received_at")
        )

        items = (
            [EmailThreadItemSerializer.from_scheduled(e) for e in outbound]
            + [EmailThreadItemSerializer.from_inbound(e) for e in inbound]
        )
        items.sort(key=lambda x: x["timestamp"], reverse=True)

        return Response(EmailThreadItemSerializer(items, many=True).data)


# ─── Credential management ────────────────────────────────────────────────────

class UserEmailCredentialViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Manage SDR Gmail credentials.

    Admin → can list/create/update/delete all SDR credentials.
    SDR  → can view and update their own credential only via /me/ action.
    """

    serializer_class = UserEmailCredentialSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return UserEmailCredential.objects.select_related("user").order_by("zoho_email")

    def get_permissions(self):
        if self.action == "me":
            return super().get_permissions()  # IsAuthenticated
        return [IsAdmin()]

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        """GET/PATCH /api/email-credentials/me/ — SDR views or updates their own credential."""
        try:
            cred = UserEmailCredential.objects.get(user=request.user)
        except UserEmailCredential.DoesNotExist:
            if request.method == "GET":
                return Response({"detail": "No credential configured yet."}, status=status.HTTP_404_NOT_FOUND)
            cred = None

        if request.method == "GET":
            return Response(UserEmailCredentialSerializer(cred).data)

        ser = UserEmailCredentialSerializer(
            cred or UserEmailCredential(user=request.user),
            data=request.data,
            partial=True,
        )
        ser.is_valid(raise_exception=True)
        instance = ser.save(user=request.user)
        return Response(UserEmailCredentialSerializer(instance).data)


# ─── Admin email queue ────────────────────────────────────────────────────────

class AdminEmailQueueView(ListAPIView):
    """GET /api/admin/email-queue/

    Returns all ScheduledEmails with lead name, company, and assigned SDR —
    so the admin can see every email sent or pending across all SDRs in one place.

    Query params:
      status        — PENDING | SENT | FAILED | CANCELLED (repeatable)
      assigned_to   — user id (integer); filters by the lead's assigned SDR
    """

    permission_classes = [IsAdmin]
    serializer_class = AdminEmailQueueSerializer
    pagination_class = None

    def get_queryset(self):
        from django.db.models import Exists, OuterRef, Subquery

        reply_qs = InboundEmail.objects.filter(lead=OuterRef("lead"))

        qs = (
            ScheduledEmail.objects
            .select_related(
                "template", "triggered_by", "rule",
                "lead", "lead__assigned_to",
            )
            .annotate(
                has_reply=Exists(reply_qs),
                latest_reply_at=Subquery(
                    reply_qs.order_by("-received_at").values("received_at")[:1]
                ),
                latest_reply_subject=Subquery(
                    reply_qs.order_by("-received_at").values("subject")[:1]
                ),
            )
            .order_by("-send_at")
        )

        statuses = self.request.query_params.getlist("status")
        if statuses:
            qs = qs.filter(status__in=statuses)

        assigned_to = self.request.query_params.get("assigned_to")
        if assigned_to:
            qs = qs.filter(lead__assigned_to=assigned_to)

        return qs
