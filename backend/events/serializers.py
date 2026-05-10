from rest_framework import serializers

from leads.models import PackageTier, SubPipeline

from .models import Event


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = (
            "id",
            "name",
            "city",
            "country",
            "start_date",
            "end_date",
            "is_active",
        )


class _NestedTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageTier
        fields = (
            "id",
            "name",
            "default_price_inr",
            "default_price_usd",
            "is_active",
            "sort_order",
        )


class _NestedSubPipelineSerializer(serializers.ModelSerializer):
    tiers = serializers.SerializerMethodField()

    class Meta:
        model = SubPipeline
        fields = ("id", "name", "slug", "is_active", "sort_order", "tiers")

    def get_tiers(self, obj: SubPipeline):
        # The view prefetches `tiers` so this is O(1) per sub-pipeline.
        rows = sorted(obj.tiers.all(), key=lambda t: (t.sort_order, t.name))
        return _NestedTierSerializer(rows, many=True).data


class EventWithPipelinesSerializer(EventSerializer):
    """Event payload with sub-pipelines + tiers nested.

    Powers the /admin/pipelines page so it can render the entire
    Event → SubPipeline → Tier hierarchy in one request.
    """

    sub_pipelines = serializers.SerializerMethodField()

    class Meta(EventSerializer.Meta):
        fields = EventSerializer.Meta.fields + ("sub_pipelines",)

    def get_sub_pipelines(self, obj: Event):
        rows = sorted(obj.sub_pipelines.all(), key=lambda s: (s.sort_order, s.name))
        return _NestedSubPipelineSerializer(rows, many=True).data
