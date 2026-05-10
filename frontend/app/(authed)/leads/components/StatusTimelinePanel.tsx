"use client";

import { useEffect, useState } from "react";

import { Card, Spinner, StatusChip } from "@/components/ui";
import {
  api,
  type LeadStatus,
  type StatusHistory,
} from "@/lib/api";

interface StatusTimelinePanelProps {
  leadId: string;
  /** Bumped by parent on save so we re-fetch after a status change. */
  refreshKey?: number;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StatusTimelinePanel({
  leadId,
  refreshKey = 0,
}: StatusTimelinePanelProps) {
  const [items, setItems] = useState<StatusHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    api.leads
      .statusHistory(leadId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load status history.");
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey]);

  return (
    <Card title="Status timeline" description="Every flip, with the comment.">
      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : items === null ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" label="Loading…" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No status changes yet.</p>
      ) : (
        <ol className="relative pl-4 border-l-2 border-slate-200 space-y-4">
          {items.map((s) => (
            <li key={s.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-white shadow" />
              <div className="flex items-center gap-2 flex-wrap">
                {s.from_status && (
                  <>
                    <StatusChip status={s.from_status as LeadStatus} />
                    <span className="text-slate-400 text-xs">→</span>
                  </>
                )}
                <StatusChip status={s.to_status as LeadStatus} />
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formatWhen(s.changed_at)}
                {s.changed_by_username ? ` · ${s.changed_by_username}` : ""}
              </div>
              {s.comment && (
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                  {s.comment}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
