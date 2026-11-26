import calendar
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
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

        recent_leads_qs = (
            Lead.objects.filter(
                created_at__gte=month_start, created_at__lte=month_end
            )
            .select_related("assigned_to", "sub_pipeline")
            .order_by("-created_at")[:8]
        )
        recent_leads = [
            {
                "id": str(l.id),
                "full_name": l.full_name,
                "company": l.company or "",
                "status": l.status,
                "sub_pipeline_name": l.sub_pipeline.name if l.sub_pipeline else "",
                "assigned_to_username": l.assigned_to.username if l.assigned_to else "",
                "created_at": l.created_at.isoformat(),
            }
            for l in recent_leads_qs
        ]

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
            "recent_leads": recent_leads,
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
        user_ids = [u.id for u in users]

        # Fixed number of grouped queries regardless of how many callers exist —
        # each query is a round trip to Neon, so per-user loops were the cost.
        interaction_month = Interaction.objects.filter(
            user_id__in=user_ids,
            occurred_at__gte=month_start,
            occurred_at__lte=month_end,
        )
        interaction_counts = {
            row["user"]: row
            for row in interaction_month.order_by().values("user").annotate(
                calls=Count("id", filter=Q(type=Interaction.Type.CALL)),
                emails=Count("id", filter=Q(type=Interaction.Type.EMAIL)),
                total=Count("id"),
            )
        }

        touched: dict[int, set] = defaultdict(set)
        for uid, lead_id in interaction_month.order_by().values_list("user", "lead").distinct():
            touched[uid].add(lead_id)
        for uid, lead_id in (
            StatusHistory.objects.filter(
                changed_by_id__in=user_ids,
                changed_at__gte=month_start,
                changed_at__lte=month_end,
            )
            .order_by()
            .values_list("changed_by", "lead")
            .distinct()
        ):
            touched[uid].add(lead_id)

        # Leads assigned: how many leads were created this month for this user.
        assigned_counts = dict(
            Lead.objects.filter(
                assigned_to_id__in=user_ids,
                created_at__gte=month_start,
                created_at__lte=month_end,
            )
            .order_by()
            .values("assigned_to")
            .annotate(n=Count("id"))
            .values_list("assigned_to", "n")
        )

        # Follow-ups due: live overdue count for current month only; null for past months.
        followup_counts = {}
        if is_current_month:
            followup_counts = dict(
                Lead.objects.filter(assigned_to_id__in=user_ids, next_followup_at__lte=now)
                .exclude(
                    status__in=(
                        Lead.Status.DEAL_WON,
                        Lead.Status.DEAL_LOST,
                        Lead.Status.DECLINED,
                    )
                )
                .order_by()
                .values("assigned_to")
                .annotate(n=Count("id"))
                .values_list("assigned_to", "n")
            )

        won_by_user: dict[int, set] = defaultdict(set)
        for uid, lead_id in (
            StatusHistory.objects.filter(
                changed_by_id__in=user_ids,
                to_status=Lead.Status.DEAL_WON,
                changed_at__gte=month_start,
                changed_at__lte=month_end,
            )
            .order_by()
            .values_list("changed_by", "lead")
            .distinct()
        ):
            won_by_user[uid].add(lead_id)
        all_won_ids = set().union(*won_by_user.values()) if won_by_user else set()
        won_deals = {
            lead_id: (currency, value)
            for lead_id, currency, value in Lead.objects.filter(id__in=all_won_ids).values_list(
                "id", "deal_currency", "deal_value"
            )
        }

        rows = []
        for u in users:
            counts = interaction_counts.get(u.id, {})
            won_ids = won_by_user.get(u.id, set())
            revenue = {"INR": Decimal("0"), "USD": Decimal("0")}
            for lead_id in won_ids:
                currency, value = won_deals.get(lead_id, (None, None))
                if value is not None and currency in revenue:
                    revenue[currency] += value

            rows.append({
                "user_id": u.id,
                "username": u.username,
                "full_name": (f"{u.first_name} {u.last_name}").strip() or u.username,
                "is_active": u.is_active,
                "calls_month": counts.get("calls", 0),
                "emails_month": counts.get("emails", 0),
                "leads_touched_month": len(touched.get(u.id, ())),
                "interactions_month": counts.get("total", 0),
                "followups_due": followup_counts.get(u.id, 0) if is_current_month else None,
                "leads_assigned": assigned_counts.get(u.id, 0),
                "conversions_month": len(won_ids),
                "revenue_month_inr": str(revenue["INR"]),
                "revenue_month_usd": str(revenue["USD"]),
            })

        return Response(rows)
