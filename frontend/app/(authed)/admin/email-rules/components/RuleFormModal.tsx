"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

import { Button, Input, Modal } from "@/components/ui";
import { STATUS_LABEL } from "@/components/ui/StatusChip";
import {
  api,
  LEAD_STATUSES,
  type EmailRule,
  type EmailRuleWritePayload,
  type EmailTemplate,
  type LeadStatus,
} from "@/lib/api";

interface Props {
  open: boolean;
  initial: EmailRule | null;
  templates: EmailTemplate[];
  onClose: () => void;
  onSaved: (rule: EmailRule) => void;
}

interface FormState {
  name: string;
  trigger_status: LeadStatus;
  template: string;  // stored as string for <select>
  delay_hours: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: "",
  trigger_status: "INFO_SENT",
  template: "",
  delay_hours: "0",
  is_active: true,
};

function describeError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return "Can't reach the server.";
    const d = e.response.data as Record<string, unknown> | undefined;
    if (d) {
      if (typeof d.detail === "string") return d.detail;
      const [field, msg] = Object.entries(d)[0] ?? [];
      if (field) return `${field}: ${Array.isArray(msg) ? msg.join(" ") : msg}`;
    }
    return `Server error ${e.response.status}.`;
  }
  return "Couldn't save.";
}

/** Describe the delay in human-friendly terms. */
function delayLabel(hours: number): string {
  if (hours === 0) return "immediately (within ~60 seconds)";
  if (hours === 1) return "after 1 hour";
  if (hours < 24) return `after ${hours} hours`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  if (rem === 0) return `after ${days} day${days > 1 ? "s" : ""}`;
  return `after ${days}d ${rem}h`;
}

export function RuleFormModal({ open, initial, templates, onClose, onSaved }: Props) {
  const isEdit = initial !== null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTemplates = templates.filter((t) => t.is_active);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      initial
        ? {
            name: initial.name,
            trigger_status: initial.trigger_status,
            template: String(initial.template),
            delay_hours: String(initial.delay_hours),
            is_active: initial.is_active,
          }
        : {
            ...EMPTY,
            template: activeTemplates[0] ? String(activeTemplates[0].id) : "",
          },
    );
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const delayHours = Number(form.delay_hours);
  const delayValid = Number.isInteger(delayHours) && delayHours >= 0 && delayHours <= 168;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.template) { setError("Please select a template."); return; }
    if (!delayValid) { setError("Delay must be a whole number of hours between 0 and 168."); return; }

    setSaving(true);
    setError(null);
    try {
      const payload: EmailRuleWritePayload = {
        name: form.name.trim(),
        trigger_status: form.trigger_status,
        template: Number(form.template),
        delay_hours: delayHours,
        is_active: form.is_active,
      };
      const saved = isEdit && initial
        ? await api.emails.updateRule(initial.id, payload)
        : await api.emails.createRule(payload);
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
      title={isEdit ? `Edit rule — "${initial?.name}"` : "New trigger rule"}
      description="When a lead reaches the trigger status, this rule queues the chosen email."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="rule-form" type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create rule"}
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Rule name *"
          name="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          autoComplete="off"
          placeholder="e.g. Info pack on Info Sent"
          hint="Internal label for this rule."
        />

        {/* Trigger status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Trigger status *
          </label>
          <select
            value={form.trigger_status}
            onChange={(e) => set("trigger_status", e.target.value as LeadStatus)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            The rule fires every time a lead is moved to this stage.
          </p>
        </div>

        {/* Template */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email template *
          </label>
          {activeTemplates.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              No active templates found.{" "}
              <a href="/admin/email-templates" className="text-brand-600 hover:underline">
                Create one first.
              </a>
            </div>
          ) : (
            <select
              value={form.template}
              onChange={(e) => set("template", e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="" disabled>Select a template…</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Delay */}
        <div>
          <Input
            label="Delay (hours)"
            name="delay_hours"
            type="number"
            min={0}
            max={168}
            step={1}
            value={form.delay_hours}
            onChange={(e) => set("delay_hours", e.target.value)}
            hint={delayValid ? `Email will be sent ${delayLabel(delayHours)}.` : "Enter a value between 0 and 168."}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Active — rule fires on matching status changes
        </label>
      </form>
    </Modal>
  );
}
