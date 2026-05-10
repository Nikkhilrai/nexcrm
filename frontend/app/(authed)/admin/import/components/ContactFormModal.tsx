"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

import { Button, Input, Modal, Select, type SelectOption } from "@/components/ui";
import { api, type Contact, type ContactWritePayload, type LeadSource } from "@/lib/api";

const SOURCE_OPTIONS: SelectOption[] = [
  { value: "WEBSITE_FORM", label: "Website form" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "REFERRAL", label: "Referral" },
  { value: "COLD_CALL", label: "Cold call" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
];

interface FormState {
  full_name: string;
  phone: string;
  email: string;
  company: string;
  designation: string;
  linkedin_url: string;
  source: LeadSource;
}

const EMPTY: FormState = {
  full_name: "",
  phone: "",
  email: "",
  company: "",
  designation: "",
  linkedin_url: "",
  source: "OTHER",
};

function fromContact(c: Contact): FormState {
  return {
    full_name: c.full_name,
    phone: c.phone,
    email: c.email,
    company: c.company,
    designation: c.designation,
    linkedin_url: c.linkedin_url,
    source: c.source,
  };
}

export interface ContactFormModalProps {
  open: boolean;
  initial: Contact | null;
  onClose: () => void;
  onSaved: (contact: Contact) => void;
}

export function ContactFormModal({ open, initial, onClose, onSaved }: ContactFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when the modal opens with a different contact (or for create).
  useEffect(() => {
    if (open) {
      setForm(initial ? fromContact(initial) : EMPTY);
      setErrors({});
      setServerError(null);
    }
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v: Partial<Record<keyof FormState, string>> = {};
    if (!form.phone.trim()) v.phone = "Required.";
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      const payload: ContactWritePayload = {
        phone: form.phone.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        designation: form.designation.trim(),
        linkedin_url: form.linkedin_url.trim(),
        source: form.source,
      };
      const saved = initial
        ? await api.contacts.update(initial.id, payload)
        : await api.contacts.create(payload);
      onSaved(saved);
    } catch (e) {
      setServerError(describe(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={initial ? "Edit contact" : "Add contact"}
      description={initial ? `Editing ${initial.full_name || initial.phone}.` : "Phone is required; everything else is optional."}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="contact-form" loading={saving}>
            {initial ? "Save changes" : "Create contact"}
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {serverError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Phone *"
            name="phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={errors.phone}
            placeholder="+91…"
            autoComplete="off"
          />
          <Input
            label="Full name"
            name="full_name"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            autoComplete="off"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <Input
            label="LinkedIn URL"
            name="linkedin_url"
            value={form.linkedin_url}
            onChange={(e) => set("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/…"
          />
          <Input
            label="Company"
            name="company"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          />
          <Input
            label="Designation"
            name="designation"
            value={form.designation}
            onChange={(e) => set("designation", e.target.value)}
          />
          <Select
            label="Source"
            name="source"
            value={form.source}
            onChange={(e) => set("source", e.target.value as LeadSource)}
            options={SOURCE_OPTIONS}
          />
        </div>
      </form>
    </Modal>
  );
}

function describe(e: unknown): string {
  if (axios.isAxiosError(e) && e.response) {
    if (e.response.status === 403) return "Admin only.";
    const data = e.response.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      // DRF returns {field: [msg]} or {detail: msg}.
      if (typeof data.detail === "string") return data.detail;
      const first = Object.entries(data)[0];
      if (first) {
        const [field, msg] = first;
        return `${field}: ${Array.isArray(msg) ? msg.join(" ") : String(msg)}`;
      }
    }
    return `Server returned ${e.response.status}.`;
  }
  return "Couldn't save.";
}
