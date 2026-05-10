"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

import { Button, Input, Modal } from "@/components/ui";
import {
  api,
  type Event as ApiEvent,
  type SubPipeline,
  type SubPipelineWritePayload,
} from "@/lib/api";

interface SubPipelineFormModalProps {
  open: boolean;
  /** Edit target. `null` → create mode. */
  initial: SubPipeline | null;
  /** Event the new sub-pipeline belongs to (create mode). Locked in edit mode. */
  event: ApiEvent | null;
  onClose: () => void;
  onSaved: (sp: SubPipeline) => void;
}

interface FormState {
  name: string;
  sort_order: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  sort_order: "0",
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

export function SubPipelineFormModal({
  open,
  initial,
  event,
  onClose,
  onSaved,
}: SubPipelineFormModalProps) {
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
            sort_order: String(initial.sort_order),
            is_active: initial.is_active,
          }
        : EMPTY_FORM,
    );
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const sortOrderNum = Number(form.sort_order);
    if (!Number.isFinite(sortOrderNum) || sortOrderNum < 0) {
      setError("Sort order must be a non-negative number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const targetEventId = isEdit && initial ? initial.event : event?.id;
      if (!targetEventId) {
        setError("No event scope.");
        setSaving(false);
        return;
      }
      const payload: SubPipelineWritePayload = {
        event: targetEventId,
        name: form.name.trim(),
        sort_order: sortOrderNum,
        is_active: form.is_active,
      };
      const saved =
        isEdit && initial
          ? await api.subPipelines.update(initial.id, payload)
          : await api.subPipelines.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  const eventLabel = event
    ? `${event.city} — ${event.name}`
    : "Loading…";

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={isEdit ? `Edit "${initial?.name}"` : "New sub-pipeline"}
      description={
        isEdit
          ? "Event can't be changed — would orphan existing leads. Edit name, sort order, and active state."
          : `Adding a new sub-pipeline under ${eventLabel}.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="subpipeline-form" type="submit" loading={saving}>
            {isEdit ? "Save" : "Create sub-pipeline"}
          </Button>
        </>
      }
    >
      <form id="subpipeline-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <Input
          label="Event"
          name="event_label"
          value={eventLabel}
          disabled
          readOnly
          hint={isEdit ? "Locked: would orphan attached leads." : undefined}
        />
        <Input
          label="Sub-pipeline name *"
          name="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          autoComplete="off"
          placeholder="e.g. Sponsors, Speakers, Influencer Track"
          hint="Slug is auto-generated from this name."
        />
        <Input
          label="Sort order"
          name="sort_order"
          type="number"
          min={0}
          value={form.sort_order}
          onChange={(e) => set("sort_order", e.target.value)}
          hint="Lower = appears earlier in the tab row."
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Active — appears in lead-form dropdowns and master filters
        </label>
      </form>
    </Modal>
  );
}
