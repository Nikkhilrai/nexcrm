"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui";
import { STATUS_LABEL } from "@/components/ui/StatusChip";
import { LEAD_STATUSES, type DashboardPayload } from "@/lib/api";

// Order from "top of funnel" to outcomes so the bar chart reads naturally.
const FUNNEL_ORDER = LEAD_STATUSES;

interface ChartsProps {
  data: DashboardPayload;
}

export function Charts({ data }: ChartsProps) {
  const funnel = FUNNEL_ORDER.map((status) => {
    const row = data.leads_by_status.find((r) => r.status === status);
    return { status, label: STATUS_LABEL[status], count: row?.count ?? 0 };
  });

  const byEvent = data.leads_by_event.map((r) => ({
    label: r.city,
    count: r.count,
  }));

  const conversions = data.conversions_by_day.map((r) => ({
    day: r.day.slice(5), // "MM-DD"
    count: r.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="Pipeline funnel" description="Leads created this month, grouped by status.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="count" fill="#f99c00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Leads by event" description="New leads this month per event.">
        <div className="h-64">
          {byEvent.length === 0 ? (
            <p className="text-sm text-slate-500 italic flex items-center justify-center h-full">
              No leads tied to events yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byEvent}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="#0f172b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card
        title="Conversions by day"
        description="WON status flips per day this month."
        className="lg:col-span-2"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={conversions}
              margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#f99c00"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f99c00" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
