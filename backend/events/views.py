from django.db.models import Prefetch, ProtectedError
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from leads.models import PackageTier, SubPipeline

from .models import Event
from .serializers import EventSerializer, EventWithPipelinesSerializer


class EventViewSet(viewsets.ModelViewSet):
    """CRUD on events.

    - GET (list/retrieve) — any authenticated user (powers the lead-form
      Event dropdown + master filter).
    - POST / PATCH / PUT / DELETE — admin only (the /admin/pipelines page).
    - `?active_only=true` filters to active events.
    - `?with_pipelines=true` nests `sub_pipelines` (each with their `tiers`)
      so the admin page can render the full hierarchy in one request.
    - Pagination disabled — there are only a handful of events at any time.
    - Hard delete blocked when leads still reference the event (PROTECT);
      surfaces a clean DRF 400 with the "deactivate instead" hint.
    """

    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self._wants_pipelines():
            return EventWithPipelinesSerializer
        return EventSerializer

    def _wants_pipelines(self) -> bool:
        return (
            self.action in ("list", "retrieve")
            and self.request.query_params.get("with_pipelines", "").lower() == "true"
        )

    def get_queryset(self):
        qs = Event.objects.all()
        if self.request.query_params.get("active_only", "").lower() == "true":
            qs = qs.filter(is_active=True)
        if self._wants_pipelines():
            tier_qs = PackageTier.objects.order_by("sort_order", "name")
            sp_qs = SubPipeline.objects.order_by("sort_order", "name").prefetch_related(
                Prefetch("tiers", queryset=tier_qs)
            )
            qs = qs.prefetch_related(Prefetch("sub_pipelines", queryset=sp_qs))
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError as e:
            count = len(e.protected_objects)
            raise ValidationError(
                {
                    "detail": (
                        f"Can't delete '{instance.name}' — {count} lead"
                        f"{'s' if count != 1 else ''} still attached. "
                        f"Deactivate it instead so it disappears from new-lead "
                        f"dropdowns without breaking historical data."
                    )
                }
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
