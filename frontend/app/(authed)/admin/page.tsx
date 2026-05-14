"use client";

import { useEffect, useState } from "react";
import axios from "axios";

import { Spinner } from "@/components/ui";
import {
  api,
  type DashboardPayload,
  type UserActivityRow,
} from "@/lib/api";

import { KpiGrid } from "./components/KpiGrid";
import { Charts } from "./components/Charts";
import { RecentLeads } from "./components/RecentLeads";
import { UserActivityTable } from "./components/UserActivityTable";

function currentYearMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);
  const [overview, setOverview] = useState<DashboardPayload | null>(null);
  const [activity, setActivity] = useState<UserActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.dashboards.overview(selectedMonth),
      api.dashboards.userActivity(selectedMonth),
    ])
      .then(([ov, ac]) => {
        if (cancelled) return;
        setOverview(ov);
        setActivity(ac);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (axios.isAxiosError(e) && !e.response) {
          setError("Can't reach the server. Is the backend running?");
        } else if (axios.isAxiosError(e) && e.response?.status === 403) {
          setError("Admin only. You shouldn't be seeing this — check your role.");
        } else {
          setError("Couldn't load dashboard data.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl text-ink-900">Admin dashboard</h1>
          <p className="text-sm text-slate-600">
            All data is scoped to the selected month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="month-picker" className="text-sm text-slate-600 whitespace-nowrap">
            Viewing month:
          </label>
          <input
            id="month-picker"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      ) : loading || !overview || !activity ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading dashboard…" />
        </div>
      ) : (
        <>
          <KpiGrid kpis={overview.kpis} />
          <Charts data={overview} />
          <RecentLeads leads={overview.recent_leads} monthLabel={overview.kpis.month_label} />
          <UserActivityTable
            rows={activity}
            monthLabel={overview.kpis.month_label}
            isCurrentMonth={selectedMonth === currentYearMonth()}
          />
        </>
      )}
    </div>
  );
}
