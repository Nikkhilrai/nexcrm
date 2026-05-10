from rest_framework import serializers

from events.serializers import EventSerializer

from .models import Contact, Interaction, Lead, PackageTier, StatusHistory, SubPipeline


class SubPipelineSerializer(serializers.ModelSerializer):
    """CRUD payload for /api/sub-pipelines/.

    Slug is server-derived from name on create — admin types a name and we
    slugify it (deduped within the event). On update, slug stays unless the
    name itself changes.
    """

    class Meta:
        model = SubPipeline
        fields = (
            "id",
            "event",
            "name",
            "slug",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")

    def _generate_slug(self, event_id: int, name: str, exclude_id: int | None = None) -> str:
        from django.utils.text import slugify

        base = slugify(name) or "pipeline"
        candidate = base
        n = 2
        while True:
            qs = SubPipeline.objects.filter(event_id=event_id, slug=candidate)
            if exclude_id is not None:
                qs = qs.exclude(pk=exclude_id)
            if not qs.exists():
                return candidate
            candidate = f"{base}-{n}"
            n += 1

    def create(self, validated_data):
        validated_data["slug"] = self._generate_slug(
            validated_data["event"].id, validated_data["name"]
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        new_name = validated_data.get("name", instance.name)
        if new_name != instance.name:
            validated_data["slug"] = self._generate_slug(
                instance.event_id, new_name, exclude_id=instance.pk
            )
        return super().update(instance, validated_data)


class PackageTierBriefSerializer(serializers.ModelSerializer):
    """Compact tier payload nested inside lead responses."""

    class Meta:
        model = PackageTier
        fields = (
            "id",
            "sub_pipeline",
            "name",
            "default_price_inr",
            "default_price_usd",
            "is_active",
            "sort_order",
        )
        read_only_fields = fields


class PackageTierSerializer(serializers.ModelSerializer):
    """Full tier serializer used by /api/tiers/ CRUD (admin)."""

    class Meta:
        model = PackageTier
        fields = (
            "id",
            "sub_pipeline",
            "name",
            "default_price_inr",
            "default_price_usd",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class _AssignedUserBrief(serializers.Serializer):
    """Tiny read-only payload for assigned/created_by/changed_by relations."""

    id = serializers.IntegerField()
    username = serializers.CharField()
    role = serializers.CharField()


class LeadListSerializer(serializers.ModelSerializer):
    """Compact payload for the home-page leads table + kanban cards."""

    event = EventSerializer(source="event_interest", read_only=True)
    package_tier_name = serializers.CharField(
        source="package_tier.name", read_only=True, default=None
    )
    sub_pipeline_name = serializers.CharField(
        source="sub_pipeline.name", read_only=True, default=None
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username", read_only=True, default=None
    )
    latest_status_note = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = (
            "id",
            "full_name",
            "phone",
            "company",
            "designation",
            "status",
            "source",
            "sub_pipeline",
            "sub_pipeline_name",
            "package_tier",
            "package_tier_name",
            "event",
            "assigned_to",
            "assigned_to_username",
            "next_followup_at",
            "created_at",
            "latest_status_note",
        )
        read_only_fields = fields

    def get_latest_status_note(self, obj: Lead):
        """Most recent StatusHistory row's comment + actor + timestamp.

        Returns null when:
          - no history rows exist (shouldn't happen — signal writes one on create)
          - the latest row's comment is empty (e.g. the auto-row from create with
            no `_status_change_comment` set)

        Relies on the prefetched `status_history` queryset being ordered
        DESC by `changed_at` (LeadViewSet.get_queryset configures that).
        """
        history = list(obj.status_history.all())
        if not history:
            return None
        latest = history[0]
        if not latest.comment:
            return None
        return {
            "comment": latest.comment,
            "to_status": latest.to_status,
            "changed_at": latest.changed_at.isoformat(),
            "changed_by_username": (
                latest.changed_by.username if latest.changed_by else None
            ),
        }


class LeadDetailSerializer(serializers.ModelSerializer):
    """Full payload for create / retrieve / update on the edit page.

    `status_change_comment` is a write-only transient field — it isn't
    stored on the Lead, but is consumed by the StatusHistory signal via
    instance attributes. Required when the request actually changes status.
    """

    event = EventSerializer(source="event_interest", read_only=True)
    package_tier_detail = PackageTierBriefSerializer(
        source="package_tier", read_only=True
    )
    status_change_comment = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username", read_only=True, default=None
    )

    class Meta:
        model = Lead
        fields = (
            "id",
            "full_name",
            "email",
            "phone",
            "company",
            "designation",
            "linkedin_url",
            "city",
            "country",
            "event_interest",
            "event",
            "sub_pipeline",
            "package_tier",
            "package_tier_detail",
            "source",
            "status",
            "status_change_comment",
            "assigned_to",
            "assigned_to_username",
            "next_followup_at",
            "deal_value",
            "deal_currency",
            "notes",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        # If both sub_pipeline and package_tier are set, the tier must
        # belong to that sub-pipeline. Catches stale dropdown selections from
        # the frontend (e.g. user switches sub-pipeline but doesn't reset tier).
        sub_pipeline = attrs.get("sub_pipeline") or (
            self.instance.sub_pipeline if self.instance else None
        )
        tier = attrs.get("package_tier")
        if tier is not None and sub_pipeline is not None and tier.sub_pipeline_id != sub_pipeline.id:
            raise serializers.ValidationError(
                {
                    "package_tier": (
                        f"Tier '{tier.name}' belongs to '{tier.sub_pipeline.name}', "
                        f"not '{sub_pipeline.name}'."
                    )
                }
            )
        # The sub-pipeline's event must match the lead's event — picked Dubai
        # but a Mumbai sub-pipeline = bug. The form cascades these but check.
        event = attrs.get("event_interest") or (
            self.instance.event_interest if self.instance else None
        )
        if sub_pipeline is not None and event is not None and sub_pipeline.event_id != event.id:
            raise serializers.ValidationError(
                {
                    "sub_pipeline": (
                        f"Sub-pipeline '{sub_pipeline.name}' belongs to "
                        f"{sub_pipeline.event.city}, not {event.city}."
                    )
                }
            )
        # deal_value requires deal_currency (the field has a default so this
        # only fires if someone explicitly clears deal_currency while keeping a value).
        deal_value = attrs.get(
            "deal_value",
            self.instance.deal_value if self.instance else None,
        )
        deal_currency = attrs.get(
            "deal_currency",
            self.instance.deal_currency if self.instance else None,
        )
        if deal_value is not None and not deal_currency:
            raise serializers.ValidationError(
                {"deal_currency": "deal_currency is required when deal_value is set."}
            )
        # On update, if status is being changed, comment is required.
        if self.instance is not None and "status" in attrs:
            new_status = attrs["status"]
            if new_status != self.instance.status:
                comment = attrs.get("status_change_comment", "")
                if not comment.strip():
                    raise serializers.ValidationError(
                        {
                            "status_change_comment": (
                                "A comment is required when changing the lead's status."
                            )
                        }
                    )
        return attrs

    def create(self, validated_data):
        validated_data.pop("status_change_comment", None)
        request = self.context.get("request")
        actor = request.user if request else None
        instance = Lead(**validated_data)
        instance.created_by = actor
        instance._status_changed_by = actor
        instance.save()
        _ensure_contact_for_lead(instance, actor)
        return instance

    def update(self, instance, validated_data):
        comment = validated_data.pop("status_change_comment", "")
        request = self.context.get("request")
        actor = request.user if request else None
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance._status_change_comment = comment
        instance._status_changed_by = actor
        instance.save()
        return instance


def _ensure_contact_for_lead(lead: Lead, actor) -> None:
    """Auto-grow the Contacts DB when a Lead is saved with a phone we
    haven't seen. If the phone already maps to a Contact, do nothing
    (snapshot semantics — the master Contact stays canonical).
    """
    phone = (lead.phone or "").strip()
    if not phone:
        return
    Contact.objects.get_or_create(
        phone=phone,
        defaults={
            "full_name": lead.full_name or "",
            "email": lead.email or "",
            "company": lead.company or "",
            "designation": lead.designation or "",
            "linkedin_url": lead.linkedin_url or "",
            "source": lead.source or Lead.Source.OTHER,
            "created_by": actor,
        },
    )


class ContactSerializer(serializers.ModelSerializer):
    """Serializer for /api/contacts/ — list, retrieve, manual create.

    Phone is the unique key. Other fields optional. Bulk upload uses its own
    code path (see ContactViewSet.bulk_upload) and bypasses this serializer
    so per-row errors can be reported without raising.
    """

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None
    )

    class Meta:
        model = Contact
        fields = (
            "id",
            "full_name",
            "phone",
            "email",
            "company",
            "designation",
            "linkedin_url",
            "source",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class InteractionSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(
        source="user.username", read_only=True, default=None
    )

    class Meta:
        model = Interaction
        fields = (
            "id",
            "lead",
            "user",
            "user_username",
            "type",
            "outcome",
            "notes",
            "occurred_at",
            "created_at",
        )
        read_only_fields = ("id", "lead", "user", "created_at")


class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(
        source="changed_by.username", read_only=True, default=None
    )

    class Meta:
        model = StatusHistory
        fields = (
            "id",
            "from_status",
            "to_status",
            "comment",
            "changed_by",
            "changed_by_username",
            "changed_at",
        )
        read_only_fields = fields
