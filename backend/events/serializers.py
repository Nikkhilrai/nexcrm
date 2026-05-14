from django.contrib.auth import get_user_model
from rest_framework import serializers

from leads.models import PackageTier, SubPipeline

from .models import Event


class EventSerializer(serializers.ModelSerializer):
    # Write-only: admin sends a list of user PKs to block from this event.
    # Omitting the field on a PATCH leaves the current blocklist unchanged.
    hidden_from = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=get_user_model()._default_manager.all(),
        required=False,
        write_only=True,
    )
    # Read-only: returns [{id, username, role}] so the admin UI can render names.
    hidden_from_users = serializers.SerializerMethodField()

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
            "hidden_from",
            "hidden_from_users",
        )

    def get_hidden_from_users(self, obj: Event):
        return [
            {"id": u.id, "username": u.username, "role": u.role}
            for u in obj.hidden_from.all()
        ]

    def update(self, instance, validated_data):
        hidden_from = validated_data.pop("hidden_from", None)
        instance = super().update(instance, validated_data)
        if hidden_from is not None:
            instance.hidden_from.set(hidden_from)
        return instance


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
