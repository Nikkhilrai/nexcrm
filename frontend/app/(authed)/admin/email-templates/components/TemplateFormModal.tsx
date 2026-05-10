"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import axios from "axios";

import { Button, Input, Modal } from "@/components/ui";
import { api, type EmailTemplate, type EmailTemplateWritePayload, MERGE_TAGS } from "@/lib/api";

interface Props {
  open: boolean;
  initial: EmailTemplate | null;
  onClose: () => void;
  onSaved: (t: EmailTemplate) => void;
}

interface FormState {
  name: string;
  subject: string;
  body_html: string;
  is_active: boolean;
}

const EMPTY: FormState = { name: "", subject: "", body_html: "", is_active: true };

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

/** Insert {{tag}} at the cursor position of a textarea or input ref. */
function insertTag(
  tag: string,
  ref: RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  value: string,
  onChange: (v: string) => void,
) {
  const el = ref.current;
  const token = `{{${tag}}}`;
  if (!el) {
    onChange(value + token);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  onChange(next);
  setTimeout(() => {
    el.focus();
    const cursor = start + token.length;
    el.setSelectionRange(cursor, cursor);
  }, 0);
}

function MergeTagChips({
  targetRef,
  value,
  onChange,
}: {
  targetRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {MERGE_TAGS.map(({ tag, label }) => (
        <button
          key={tag}
          type="button"
          onClick={() => insertTag(tag, targetRef, value, onChange)}
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
          title={`Insert {{${tag}}}`}
        >
          {`{{${label}}}`}
        </button>
      ))}
    </div>
  );
}

export function TemplateFormModal({ open, initial, onClose, onSaved }: Props) {
  const isEdit = initial !== null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      initial
        ? { name: initial.name, subject: initial.subject, body_html: initial.body_html, is_active: initial.is_active }
        : EMPTY,
    );
  }, [open, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: EmailTemplateWritePayload = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        body_html: form.body_html.trim(),
        is_active: form.is_active,
      };
      const saved = isEdit && initial
        ? await api.emails.updateTemplate(initial.id, payload)
        : await api.emails.createTemplate(payload);
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
      title={isEdit ? `Edit "${initial?.name}"` : "New email template"}
      description="Use {{tag}} merge tags — click a chip to insert at cursor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="tmpl-form" type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create template"}
          </Button>
        </>
      }
    >
      <form id="tmpl-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Template name *"
          name="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          autoComplete="off"
          placeholder="e.g. Info Pack — Delegate"
          hint="Internal label shown in dropdowns."
        />

        <div>
          <Input
            label="Subject line *"
            name="subject"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            required
            autoComplete="off"
            placeholder="Hi {{lead_first_name}}, your info for {{event_city}} is ready"
            ref={subjectRef}
          />
          <MergeTagChips
            targetRef={subjectRef}
            value={form.subject}
            onChange={(v) => set("subject", v)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Body *
          </label>
          <textarea
            ref={bodyRef}
            name="body_html"
            value={form.body_html}
            onChange={(e) => set("body_html", e.target.value)}
            required
            rows={8}
            placeholder={"<p>Dear {{lead_name}},</p>\n<p>Here is the info about {{event_name}}.</p>\n<p>Best,<br>{{sender_name}}</p>"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono leading-relaxed resize-y"
          />
          <MergeTagChips
            targetRef={bodyRef}
            value={form.body_html}
            onChange={(v) => set("body_html", v)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Plain text or HTML. Use &lt;p&gt;, &lt;b&gt;, &lt;br&gt; for formatting.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Active — available for rules and manual sends
        </label>
      </form>
    </Modal>
  );
}
