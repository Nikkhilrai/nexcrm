import django_filters

from .models import Lead


class LeadFilter(django_filters.FilterSet):
    """Powers the home-page filter bar.

    - status: multi-select via repeated query params (?status=NEW&status=CONTACTED)
    - created_after / created_before: ISO datetime range
    - All other FK / choice filters: exact match
    """

    status = django_filters.MultipleChoiceFilter(choices=Lead.Status.choices)
    created_after = django_filters.IsoDateTimeFilter(
        field_name="created_at", lookup_expr="gte"
    )
    created_before = django_filters.IsoDateTimeFilter(
        field_name="created_at", lookup_expr="lte"
    )
    next_followup_after = django_filters.IsoDateTimeFilter(
        field_name="next_followup_at", lookup_expr="gte"
    )
    next_followup_before = django_filters.IsoDateTimeFilter(
        field_name="next_followup_at", lookup_expr="lte"
    )

    class Meta:
        model = Lead
        fields = (
            "status",
            "event_interest",
            "sub_pipeline",
            "package_tier",
            "source",
            "assigned_to",
        )
