"use client";

import { Card } from "@/components/ui";
import type { UserActivityRow } from "@/lib/api";

interface UserActivityTableProps {
  rows: UserActivityRow[];
  monthLabel: string;
  isCurrentMonth: boolean;
}

function fmtINR(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtUSD(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `$${n.toLocaleString("en-US")}`;
}

export function UserActivityTable({ rows, monthLabel, isCurrentMonth }: UserActivityTableProps) {
  return (
    <Card
      title={`Per-user performance — ${monthLabel}`}
      description="All figures are for the selected month. Follow-ups due is only shown for the current month."
      padding="none"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 italic px-6 py-4">No callers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-4 py-3">User</th>
                <th className="text-right font-semibold px-4 py-3">Calls</th>
                <th className="text-right font-semibold px-4 py-3">Emails</th>
                <th className="text-right font-semibold px-4 py-3">Leads touched</th>
                <th className="text-right font-semibold px-4 py-3">Interactions</th>
                <th className="text-right font-semibold px-4 py-3">Wins</th>
                <th className="text-right font-semibold px-4 py-3">Rev (₹)</th>
                <th className="text-right font-semibold px-4 py-3">Rev ($)</th>
                {isCurrentMonth && (
                  <th className="text-right font-semibold px-4 py-3">Follow-ups due</th>
                )}
                <th className="text-right font-semibold px-4 py-3">Leads assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const isSlacking = (r.followups_due ?? 0) > 0 && r.leads_touched_month === 0;
                return (
                  <tr
                    key={r.user_id}
                    className={
                      isSlacking
                        ? "bg-amber-50 hover:bg-amber-100 transition-colors"
                        : "hover:bg-slate-50 transition-colors"
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{r.username}</div>
                      {r.full_name && r.full_name !== r.username && (
                        <div className="text-xs text-slate-500">{r.full_name}</div>
                      )}
                      {!r.is_active && (
                        <div className="text-[11px] text-rose-600">inactive</div>
                      )}
                      {isSlacking && (
                        <div className="text-[11px] text-amber-700 font-medium">
                          overdue follow-ups, no activity this month
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.calls_month}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.emails_month}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.leads_touched_month}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.interactions_month}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.conversions_month}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtINR(r.revenue_month_inr)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtUSD(r.revenue_month_usd)}</td>
                    {isCurrentMonth && (
                      <td
                        className={`px-4 py-3 text-right ${
                          (r.followups_due ?? 0) > 0 ? "text-rose-700 font-medium" : "text-slate-700"
                        }`}
                      >
                        {r.followups_due ?? 0}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-slate-700">{r.leads_assigned}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
