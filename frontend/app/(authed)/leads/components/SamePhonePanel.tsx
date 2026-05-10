"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card, Spinner, StatusChip } from "@/components/ui";
import { api, type LeadListItem } from "@/lib/api";

interface SamePhonePanelProps {
  phone: string;
  excludeId: string;
}

/** "Has this person come back to us before?" — surfaces past leads on the same
 *  phone, excluding the one being viewed. Powered by /api/leads/by-phone/. */
export function SamePhonePanel({ phone, excludeId }: SamePhonePanelProps) {
  const [rows, setRows] = useState<LeadListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) {
      setRows([]);
      return;
    }
    let cancelled = false;
    api.leads
      .byPhone(phone, excludeId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load same-phone history.");
      });
    return () => {
      cancelled = true;
    };
  }, [phone, excludeId]);

  return (
    <Card
      title="Same phone"
      description="Other leads tied to this number."
    >
      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : rows === null ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" label="Looking…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No other leads on this number.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li
              key={l.id}
              className="border border-slate-200 rounded-md p-3 hover:border-brand-300 transition-colors"
            >
              <Link href={`/leads/${l.id}`} className="block">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink-900">{l.full_name}</span>
                  <StatusChip status={l.status} />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {l.event ? `${l.event.city} · ` : ""}
                  {l.company || "—"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
