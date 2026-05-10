"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock, CheckCircle2, XCircle, AlertCircle,
  Send, Filter, MailOpen,
} from "lucide-react";

import { Badge, Button, Card, Spinner } from "@/components/ui";
import {
  api,
  type AdminEmailQueueItem,
  type AdminUser,
  type EmailStatus,
} from "@/lib/api";
import { EmailsNav } from "../email-templates/components/EmailsNav";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmailStatus,
  { label: string; tone: "amber" | "emerald" | "rose" | "neutral"; Icon: React.ElementType }
> = {
  PENDING:   { label: "Pending",   tone: "amber",   Icon: Clock },
  SENT:      { label: "Sent",      tone: "emerald",  Icon: CheckCircle2 },
  FAILED:    { label: "Failed",    tone: "rose",     Icon: AlertCircle },
  CANCELLED: { label: "Cancelled", tone: "neutral",  Icon: XCircle },
};

const ALL_STATUSES: EmailStatus[] = ["PENDING", "SENT", "FAILED", "CANCELLED"];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ─── Summary tiles ────────────────────────────────────────────────────────────

function SummaryTiles({ items }: { items: AdminEmailQueueItem[] }) {
  const counts = items.reduce<Record<EmailStatus, number>>(
    (acc, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; },
    { PENDING: 0, SENT: 0, FAILED: 0, CANCELLED: 0 },
  );

  const tiles = [
    { status: "PENDING"   as EmailStatus, label: "Pending follow-ups", color: "text-amber-700 bg-amber-50 border-amber-200" },
    { status: "SENT"      as EmailStatus, label: "Sent",               color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { status: "FAILED"    as EmailStatus, label: "Failed",             color: "text-rose-700 bg-rose-50 border-rose-200" },
    { status: "CANCELLED" as EmailStatus, label: "Cancelled",          color: "text-slate-600 bg-slate-50 border-slate-200" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map(({ status, label, color }) => {
        const cfg = STATUS_CONFIG[status];
        const Icon = cfg.Icon;
        return (
          <div key={status} className={`rounded-xl border px-4 py-3 ${color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
            </div>
            <p className="text-3xl font-bold">{counts[status]}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailQueuePage() {
  const [items, setItems] = useState<AdminEmailQueueItem[] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<EmailStatus[]>(["PENDING", "SENT", "FAILED"]);
  const [assignedFilter, setAssignedFilter] = useState<number | undefined>(undefined);

  function load() {
    setItems(null);
    setLoadError(null);
    Promise.all([
      api.emails.getEmailQueue({ status: statusFilter, assigned_to: assignedFilter }),
      api.users.list(),
    ])
      .then(([q, us]) => { setItems(q); setUsers(us); })
      .catch(() => setLoadError("Couldn't load email queue."));
  }

  useEffect(load, [statusFilter, assignedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel(item: AdminEmailQueueItem) {
    setCancellingId(item.id);
    try {
      await api.emails.cancelEmail(item.lead_id, item.id);
      setItems((prev) =>
        prev?.map((i) => i.id === item.id ? { ...i, status: "CANCELLED" as EmailStatus } : i) ?? prev,
      );
    } catch {
      window.alert("Couldn't cancel email.");
    } finally {
      setCancellingId(null);
    }
  }

  function toggleStatus(s: EmailStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Email Automation</h1>
          <p className="mt-1 text-sm text-slate-500">
            All emails sent and queued across every SDR.
          </p>
        </div>
      </div>

      <EmailsNav />

      {/* Summary tiles */}
      {items && <SummaryTiles items={items} />}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />

        {/* Status toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = statusFilter.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? s === "PENDING"   ? "bg-amber-100 border-amber-300 text-amber-800"
                    : s === "SENT"      ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : s === "FAILED"    ? "bg-rose-100 border-rose-300 text-rose-800"
                    : "bg-slate-100 border-slate-300 text-slate-700"
                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                <cfg.Icon className="w-3 h-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* SDR filter */}
        <select
          value={assignedFilter ?? ""}
          onChange={(e) => setAssignedFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">All SDRs</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.first_name || u.last_name
                ? `${u.first_name} ${u.last_name}`.trim()
                : u.username}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loadError ? (
        <p className="text-sm text-rose-700">{loadError}</p>
      ) : items === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Spinner size="sm" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <Card title="No emails match the current filters">
          <div className="text-center py-6">
            <Send className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              Try changing the status filters above.
            </p>
          </div>
        </Card>
      ) : (
        <Card title={`${items.length} email${items.length === 1 ? "" : "s"}`}>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-3 pr-4 font-medium text-slate-600">Lead</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">SDR</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Template / Subject</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Status</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Scheduled / Sent</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Lead Reply</th>
                  <th className="pb-3 font-medium text-slate-600 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  const Icon = cfg.Icon;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 group">
                      {/* Lead */}
                      <td className="py-3 pr-4">
                        <Link
                          href={`/leads/${item.lead_id}`}
                          className="font-medium text-ink-900 hover:text-brand-700 hover:underline block"
                        >
                          {item.lead_name}
                        </Link>
                        <span className="text-xs text-slate-400">{item.lead_company}</span>
                      </td>

                      {/* SDR */}
                      <td className="py-3 pr-4">
                        <span className="text-slate-700">
                          {item.assigned_to_name ?? item.assigned_to_username ?? "—"}
                        </span>
                        {item.from_email && (
                          <div className="text-[11px] text-slate-400 font-mono">{item.from_email}</div>
                        )}
                      </td>

                      {/* Template / Subject */}
                      <td className="py-3 pr-4 max-w-xs">
                        <span className="text-slate-700 font-medium">
                          {item.template_name ?? "Manual"}
                        </span>
                        {item.rule_name && (
                          <span className="ml-1.5 text-[10px] text-slate-400 bg-slate-100 rounded px-1 py-0.5">
                            auto
                          </span>
                        )}
                        <p className="text-xs text-slate-400 truncate" title={item.subject_rendered}>
                          {item.subject_rendered}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3 pr-4">
                        <Badge tone={cfg.tone}>
                          <Icon className="w-3 h-3 mr-1 inline" />
                          {cfg.label}
                        </Badge>
                        {item.status === "FAILED" && item.error_message && (
                          <p className="text-[11px] text-rose-600 mt-0.5 max-w-[160px] truncate" title={item.error_message}>
                            {item.error_message}
                          </p>
                        )}
                      </td>

                      {/* When */}
                      <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">
                        {item.status === "SENT" && item.sent_at
                          ? <>Sent {formatWhen(item.sent_at)}</>
                          : item.status === "PENDING"
                          ? <>Due {formatWhen(item.send_at)}</>
                          : formatWhen(item.send_at)}
                        {item.triggered_by_username && (
                          <div className="text-[11px] text-slate-400">
                            by {item.triggered_by_username}
                          </div>
                        )}
                      </td>

                      {/* Lead Reply */}
                      <td className="py-3 pr-4">
                        {item.has_reply ? (
                          <div>
                            <div className="flex items-center gap-1.5 text-emerald-700">
                              <MailOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-xs font-medium">Replied</span>
                            </div>
                            {item.latest_reply_subject && (
                              <p
                                className="text-[11px] text-slate-400 truncate max-w-[160px] mt-0.5"
                                title={item.latest_reply_subject}
                              >
                                {item.latest_reply_subject}
                              </p>
                            )}
                            {item.latest_reply_at && (
                              <p className="text-[11px] text-slate-400">
                                {formatWhen(item.latest_reply_at)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 text-right">
                        {item.status === "PENDING" && (
                          <button
                            onClick={() => cancel(item)}
                            disabled={cancellingId === item.id}
                            className="text-xs text-rose-500 hover:text-rose-700 hover:underline disabled:opacity-40"
                          >
                            {cancellingId === item.id ? "Cancelling…" : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
