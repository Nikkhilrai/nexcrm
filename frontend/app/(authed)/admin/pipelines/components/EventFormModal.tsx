"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

import { Button, Input, Modal } from "@/components/ui";
import { api, type Event as ApiEvent, type EventWritePayload } from "@/lib/api";

interface EventFormModalProps {
  open: boolean;
  /** `null` → create mode, otherwise edit. */
  initial: ApiEvent | null;
  onClose: () => void;
  onSaved: (event: ApiEvent) => void;
}

interface FormState {
  name: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  city: "",
  country: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

function describeError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return "Can't reach the server.";
    const data = e.response.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      if (typeof data.detail === "string") return data.detail;
      const first = Object.entries(data)[0];
      if (first) {
        const [field, msg] = first;
        const text = Array.isArray(msg) ? msg.join(" ") : String(msg);
        return `${field}: ${text}`;
      }
    }
    return `Server returned ${e.response.status}.`;
  }
  return "Couldn't save.";
}

export function EventFormModal({ open, initial, onClose, onSaved }: EventFormModalProps) {
  const isEdit = initial !== null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      initial
        ? {
            name: initial.name,
            city: initial.city,
            country: initial.country,
            start_date: initial.start_date,
            end_date: initial.end_date,
            is_active: initial.is_active,
          }
        : EMPTY_FORM,
    );
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: EventWritePayload = {
        name: form.name.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        is_active: form.is_active,
      };
      const saved =
        isEdit && initial
          ? await api.events.update(initial.id, payload)
          : await api.events.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      size="lg"
      title={isEdit ? `Edit ${initial?.name}` : "New event"}
      description="Events scope the whole pipeline hierarchy — sub-pipelines and tiers live under one."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="event-form" type="submit" loading={saving}>
            {isEdit ? "Save" : "Create event"}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Event name *"
            name="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            autoComplete="off"
            placeholder="e.g. LexTalk World Mumbai 2027"
          />
          <Input
            label="City *"
            name="city"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            required
            autoComplete="off"
            placeholder="e.g. Mumbai"
          />
          <Input
            label="Country *"
            name="country"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            label="Start date *"
            name="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) => set("start_date", e.target.value)}
            required
          />
          <Input
            label="End date *"
            name="end_date"
            type="date"
            value={form.end_date}
            onChange={(e) => set("end_date", e.target.value)}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Active — shows in lead-form dropdowns and master filters
        </label>
      </form>
    </Modal>
  );
}
