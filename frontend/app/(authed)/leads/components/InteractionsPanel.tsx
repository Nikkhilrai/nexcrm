"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import {
  Phone,
  Mail,
  Link2,
  MessageCircle,
  Users as UsersIcon,
  StickyNote,
  Plus,
  type LucideIcon,
} from "lucide-react";

import {
  Button,
  Card,
  Modal,
  Select,
  Spinner,
  Textarea,
  type SelectOption,
} from "@/components/ui";
import {
  api,
  type Interaction,
  type InteractionType,
} from "@/lib/api";

const TYPE_OPTIONS: SelectOption[] = [
  { value: "CALL", label: "Call" },
  { value: "EMAIL", label: "Email" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
];

const TYPE_ICON: Record<InteractionType, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  LINKEDIN: Link2,
  WHATSAPP: MessageCircle,
  MEETING: UsersIcon,
  NOTE: StickyNote,
};

const TYPE_LABEL: Record<InteractionType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  LINKEDIN: "LinkedIn",
  WHATSAPP: "WhatsApp",
  MEETING: "Meeting",
  NOTE: "Note",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function nowLocalInput(): string {
  // Build "YYYY-MM-DDTHH:mm" in the user's local zone for datetime-local default.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface InteractionsPanelProps {
  leadId: string;
}

export function InteractionsPanel({ leadId }: InteractionsPanelProps) {
  const [items, setItems] = useState<Interaction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Quick-add form state.
  const [type, setType] = useState<InteractionType>("CALL");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setLoadError(null);
    api.leads.interactions
      .list(leadId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load interactions.");
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  function resetForm() {
    setType("CALL");
    setOccurredAt(nowLocalInput());
    setOutcome("");
    setNotes("");
    setSaveError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const created = await api.leads.interactions.create(leadId, {
        type,
        occurred_at: occurredAt,
        outcome: outcome.trim(),
        notes: notes.trim(),
      });
      // New interactions go on top — backend orders by -occurred_at.
      setItems((prev) => (prev ? [created, ...prev] : [created]));
      setOpen(false);
      resetForm();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data) {
        const data = e.response.data as Record<string, unknown>;
        const first = Object.entries(data)[0];
        setSaveError(first ? `${first[0]}: ${String(first[1])}` : "Couldn't save.");
      } else {
        setSaveError("Couldn't save.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Interactions"
      description="Every call, email, and note logged against this lead."
      action={
        <Button
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          Log
        </Button>
      }
    >
      {loadError ? (
        <p className="text-sm text-rose-700">{loadError}</p>
      ) : items === null ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" label="Loading…" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No interactions yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const Icon = TYPE_ICON[it.type] ?? StickyNote;
            return (
              <li key={it.id} className="flex gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {TYPE_LABEL[it.type] ?? it.type}
                    </span>
                    <span>{formatWhen(it.occurred_at)}</span>
                  </div>
                  {it.outcome && (
                    <p className="text-sm text-ink-900 mt-0.5">{it.outcome}</p>
                  )}
                  {it.notes && (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                      {it.notes}
                    </p>
                  )}
                  {it.user_username && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      by {it.user_username}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Log interaction"
        description="Quick note for the audit trail."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button form="interaction-form" type="submit" loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <form id="interaction-form" onSubmit={submit} className="space-y-4">
          {saveError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
              {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as InteractionType)}
              options={TYPE_OPTIONS}
            />
            <div className="w-full">
              <label
                htmlFor="occurred_at"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                When
              </label>
              <input
                id="occurred_at"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2 bg-white text-sm text-slate-900 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>
          </div>
          <div className="w-full">
            <label
              htmlFor="outcome"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Outcome (one-liner)
            </label>
            <input
              id="outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Asked to follow up next week"
              className="w-full px-3 py-2 bg-white text-sm text-slate-900 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 placeholder:text-slate-400"
            />
          </div>
          <Textarea
            label="Notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </form>
      </Modal>
    </Card>
  );
}
