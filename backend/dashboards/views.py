import calendar
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdmin
from leads.models import Interaction, Lead, StatusHistory


def _period_anchors():
    """Return (now, week_start) in the server's TIME_ZONE (Asia/Kolkata)."""
    now = timezone.localtime()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    return now, week_start


def _parse_month(request):
    """Return (month_start, month_end) for the requested ?month=YYYY-MM,
    defaulting to the current calendar month."""
    now = timezone.localtime()
    param = request.query_params.get("month", "")
    try:
        year, month = int(param[:4]), int(param[5:7])
        if not (1 <= month <= 12):
            raise ValueError
    except (ValueError, IndexError):
        year, month = now.year, now.month

    month_start = now.replace(
        year=year, month=month, day=1,
        hour=0, minute=0, second=0, microsecond=0,
    )
    last_day = calendar.monthrange(year, month)[1]
    month_end = month_start.replace(day=last_day).replace(
        hour=23, minute=59, second=59, microsecond=999999
    )
    return month_start, month_end


def _won_lead_ids_in_window(since, until):
    """Lead IDs with a DEAL_WON transition inside [since, until] (inclusive)."""
    return (
        StatusHistory.objects.filter(
            to_status=Lead.Status.DEAL_WON,
            changed_at__gte=since,
            changed_at__lte=until,
        )
        .values_list("lead", flat=True)
        .distinct()
    )


class DashboardView(APIView):
    """GET /api/admin/dashboard/?month=YYYY-MM

    All KPIs + chart data scoped to the selected calendar month.
    Defaults to the current month. Admin only.
    """

    permission_classes = (IsAdmin,)

    def get(self, request):
        month_start, month_end = _parse_month(request)

        leads_month = Lead.objects.filter(
            created_at__gte=month_start, created_at__lte=month_end
        ).count()

        conversions_month_ids = list(_won_lead_ids_in_window(month_start, month_end))
        conversions_month = len(conversions_month_ids)

        won_qs = Lead.objects.filter(id__in=conversions_month_ids)
        revenue_month_inr = (
            won_qs.filter(deal_currency="INR").aggregate(total=Sum("deal_value"))["total"]
            or Decimal("0")
        )
        revenue_month_usd = (
            won_qs.filter(deal_currency="USD").aggregate(total=Sum("deal_value"))["total"]
            or Decimal("0")
        )

        # Avg days from create → first WON transition (scoped to this month's won deals).
        avg_days = None
        won_pairs = (
            StatusHistory.objects.filter(
                to_status=Lead.Status.DEAL_WON,
                changed_at__gte=month_start,
                changed_at__lte=month_end,
            )
            .select_related("lead")
            .values_list("lead__created_at", "changed_at")
        )
        deltas = [
            (won - created).total_seconds()
            for created, won in won_pairs
            if created and won
        ]
        if deltas:
            avg_days = round(sum(deltas) / len(deltas) / 86400, 1)

        # Pipeline funnel: leads created this month, grouped by current status.
        leads_by_status = list(
            Lead.objects.filter(
                created_at__gte=month_start, created_at__lte=month_end
            )
            .values("status")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Leads by event: created this month.
        leads_by_event_qs = list(
            Lead.objects.filter(
                created_at__gte=month_start, created_at__lte=month_end
            )
            .values("event_interest__id", "event_interest__city")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        leads_by_event = [
            {
                "event_id": row["event_interest__id"],
                "city": row["event_interest__city"],
                "count": row["count"],
            }
            for row in leads_by_event_qs
        ]

        # Daily conversion trend for the selected month.
        conversions_by_day = list(
            StatusHistory.objects.filter(
                to_status=Lead.Status.DEAL_WON,
                changed_at__gte=month_start,
                changed_at__lte=month_end,
            )
            .annotate(day=TruncDate("changed_at"))
            .values("day")
            .annotate(count=Count("lead", distinct=True))
            .order_by("day")
        )

        import calendar as _cal
        month_label = f"{_cal.month_name[month_start.month]} {month_start.year}"

        return Response({
            "kpis": {
                "month_label": month_label,
                "leads_month": leads_month,
                "conversions_month": conversions_month,
                "revenue_month_inr": str(revenue_month_inr),
                "revenue_month_usd": str(revenue_month_usd),
                "avg_conversion_days": avg_days,
            },
            "leads_by_status": leads_by_status,
            "leads_by_event": leads_by_event,
            "conversions_by_day": conversions_by_day,
        })


class UserActivityView(APIView):
    """GET /api/admin/user-activity/?month=YYYY-MM

    Per-user performance for the selected calendar month.
    `followups_due` and `leads_assigned` are always current-snapshot
    (they reflect the user's live workload regardless of month).
    Admin only. Admin-role users are excluded.
    """

    permission_classes = (IsAdmin,)

    def get(self, request):
        now, _ = _period_anchors()
        month_start, month_end = _parse_month(request)
        is_current_month = (month_start.year == now.year and month_start.month == now.month)

        users = list(User.objects.filter(role=User.Role.USER).order_by("username"))
        rows = []

        for u in users:
            calls_month = Interaction.objects.filter(
                user=u,
                type=Interaction.Type.CALL,
                occurred_at__gte=month_start,
                occurred_at__lte=month_end,
            ).count()

            emails_month = Interaction.objects.filter(
                user=u,
                type=Interaction.Type.EMAIL,
                occurred_at__gte=month_start,
                occurred_at__lte=month_end,
            ).count()

            interaction_leads = set(
                Interaction.objects.filter(
                    user=u,
                    occurred_at__gte=month_start,
                    occurred_at__lte=month_end,
                ).values_list("lead", flat=True)
            )
            history_leads = set(
                StatusHistory.objects.filter(
                    changed_by=u,
                    changed_at__gte=month_start,
                    changed_at__lte=month_end,
                ).values_list("lead", flat=True)
            )
            leads_touched_month = len(interaction_leads | history_leads)

            interactions_month = Interaction.objects.filter(
                user=u,
                occurred_at__gte=month_start,
                occurred_at__lte=month_end,
            ).count()

            # Leads assigned: how many leads were created this month for this user.
            leads_assigned = Lead.objects.filter(
                assigned_to=u,
                created_at__gte=month_start,
                created_at__lte=month_end,
            ).count()

            # Follow-ups due: live overdue count for current month only; null for past months.
            if is_current_month:
                followups_due = Lead.objects.filter(
                    assigned_to=u, next_followup_at__lte=now
                ).exclude(
                    status__in=(
                        Lead.Status.DEAL_WON,
                        Lead.Status.DEAL_LOST,
                        Lead.Status.DECLINED,
                    )
                ).count()
            else:
                followups_due = None

            won_lead_ids = list(
                StatusHistory.objects.filter(
                    changed_by=u,
                    to_status=Lead.Status.DEAL_WON,
                    changed_at__gte=month_start,
                    changed_at__lte=month_end,
                )
                .values_list("lead", flat=True)
                .distinct()
            )
            conversions_month = len(won_lead_ids)
            won_qs = Lead.objects.filter(id__in=won_lead_ids)
            revenue_month_inr = (
                won_qs.filter(deal_currency="INR").aggregate(total=Sum("deal_value"))["total"]
                or Decimal("0")
            )
            revenue_month_usd = (
                won_qs.filter(deal_currency="USD").aggregate(total=Sum("deal_value"))["total"]
                or Decimal("0")
            )

            rows.append({
                "user_id": u.id,
                "username": u.username,
                "full_name": (f"{u.first_name} {u.last_name}").strip() or u.username,
                "is_active": u.is_active,
                "calls_month": calls_month,
                "emails_month": emails_month,
                "leads_touched_month": leads_touched_month,
                "interactions_month": interactions_month,
                "followups_due": followups_due,
                "leads_assigned": leads_assigned,
                "conversions_month": conversions_month,
                "revenue_month_inr": str(revenue_month_inr),
                "revenue_month_usd": str(revenue_month_usd),
            })

        return Response(rows)
