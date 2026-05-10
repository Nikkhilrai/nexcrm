from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AdminEmailQueueView, EmailRuleViewSet, EmailTemplateViewSet, LeadEmailViewSet, UserEmailCredentialViewSet

router = DefaultRouter()
router.register(r"email-templates", EmailTemplateViewSet, basename="email-template")
router.register(r"email-rules", EmailRuleViewSet, basename="email-rule")
router.register(r"email-credentials", UserEmailCredentialViewSet, basename="email-credential")

# Nested lead emails — manually written to stay consistent with leads/urls.py
lead_email_list   = LeadEmailViewSet.as_view({"get": "list", "post": "create"})
lead_email_cancel = LeadEmailViewSet.as_view({"post": "cancel"})
lead_email_thread = LeadEmailViewSet.as_view({"get": "thread"})

urlpatterns = router.urls + [
    path("leads/<uuid:lead_pk>/emails/",                      lead_email_list,   name="lead-email-list"),
    path("leads/<uuid:lead_pk>/emails/thread/",               lead_email_thread, name="lead-email-thread"),
    path("leads/<uuid:lead_pk>/emails/<uuid:pk>/cancel/",     lead_email_cancel, name="lead-email-cancel"),
    # Admin-only flat view of all emails across all SDRs
    path("admin/email-queue/",                                AdminEmailQueueView.as_view(), name="admin-email-queue"),
]
