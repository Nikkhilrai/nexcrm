"use client";

import type { Ref } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Phone, AlertCircle } from "lucide-react";

import { Spinner, StatusChip } from "@/components/ui";
import { type LeadListItem } from "@/lib/api";

interface LeadsTableProps {
  rows: LeadListItem[];
  loading: boolean;
  loadingMore: boolean;
  /** Network or server error string. */
  error: string | null;
  /** True while there's a next cursor to fetch. */
  hasMore: boolean;
  /** Attach to the sentinel <div> below the table — its visibility triggers loadMore. */
  sentinelRef: Ref<HTMLDivElement>;
}

function formatFollowup(value: string | null): { text: string; overdue: boolean } {
  if (!value) return { text: "—", overdue: false };
  const d = new Date(value);
  const overdue = d.getTime() < Date.now();
  const text = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return { text, overdue };
}

export function LeadsTable({
  rows,
  loading,
  loadingMore,
  error,
  hasMore,
  sentinelRef,
}: LeadsTableProps) {
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Couldn't load leads.</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
        <Spinner size="lg" label="Loading leads…" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="font-heading text-lg text-ink-900">No leads match.</p>
        <p className="text-sm text-slate-600 mt-1">
          Try clearing filters or hit "+ New lead" to add one.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Name</th>
              <th className="text-left font-semibold px-4 py-3">Company</th>
              <th className="text-left font-semibold px-4 py-3">Phone</th>
              <th className="text-left font-semibold px-4 py-3">Status</th>
              <th className="text-left font-semibold px-4 py-3">Event</th>
              <th className="text-left font-semibold px-4 py-3">Sub-pipeline</th>
              <th className="text-left font-semibold px-4 py-3">Tier</th>
              <th className="text-left font-semibold px-4 py-3">Assigned</th>
              <th className="text-left font-semibold px-4 py-3">Next follow-up</th>
              <th className="w-12 px-4 py-3" aria-label="Edit" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((lead) => {
              const followup = formatFollowup(lead.next_followup_at);
              return (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-ink-900 hover:text-brand-600"
                    >
                      {lead.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{lead.company || "—"}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {lead.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.event ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {lead.event.city}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.sub_pipeline_name ?? <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.package_tier_name ?? (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.assigned_to_username ?? (
                      <span className="text-slate-400 italic">unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        followup.overdue
                          ? "text-rose-700 font-medium"
                          : "text-slate-700"
                      }
                    >
                      {followup.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="inline-flex items-center text-slate-400 hover:text-brand-600"
                      aria-label="Open lead"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sentinel + footer state */}
      <div
        ref={sentinelRef}
        className="px-4 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-center min-h-[3rem]"
      >
        {hasMore ? (
          loadingMore ? (
            <Spinner size="sm" label="Loading more…" />
          ) : (
            <span>Scroll to load more.</span>
          )
        ) : (
          <span>All caught up — {rows.length} total.</span>
        )}
      </div>
    </div>
  );
}
