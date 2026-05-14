"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card, Spinner, StatusChip } from "@/components/ui";
import { api, type LeadListItem } from "@/lib/api";

interface SamePhonePanelProps {
  phone: string;
  email?: string;
  excludeId: string;
}

/** Surfaces other leads for the same person.
 *  Email is tried first (stronger identity signal); falls back to phone. */
export function SamePhonePanel({ phone, email, excludeId }: SamePhonePanelProps) {
  const [rows, setRows] = useState<LeadListItem[] | null>(null);
  const [matchedBy, setMatchedBy] = useState<"email" | "phone">("email");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (email) {
          const data = await api.leads.byEmail(email, excludeId);
          if (!cancelled) {
            setMatchedBy("email");
            setRows(data);
          }
        } else if (phone) {
          const data = await api.leads.byPhone(phone, excludeId);
          if (!cancelled) {
            setMatchedBy("phone");
            setRows(data);
          }
        } else {
          if (!cancelled) setRows([]);
        }
      } catch {
        if (!cancelled) setError("Couldn't load lead history.");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [email, phone, excludeId]);

  const description = matchedBy === "email"
    ? "Other leads tied to this email."
    : "Other leads tied to this number.";

  return (
    <Card title="Same contact" description={description}>
      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : rows === null ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" label="Looking…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No other leads for this contact.</p>
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
