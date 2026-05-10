"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { Save } from "lucide-react";

import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
  type SelectOption,
} from "@/components/ui";
import { STATUS_LABEL } from "@/components/ui/StatusChip";
import { StatusChangeModal } from "@/components/StatusChangeModal";
import { sortSubPipelines } from "@/lib/pipelines";
import { api } from "@/lib/api";
import {
  CURRENCY_SYMBOL,
  LEAD_STATUSES,
  type AdminUser,
  type Contact,
  type Currency,
  type Event as ApiEvent,
  type LeadDetail,
  type LeadSource,
  type LeadStatus,
  type LeadWritePayload,
  type PackageTier,
  type SubPipeline,
  type User,
} from "@/lib/api";

import { ContactPicker } from "./ContactPicker";

const STATUS_OPTIONS: SelectOption[] = LEAD_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

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
  email: string;
  phone: string;
  company: string;
  designation: string;
  linkedin_url: string;
  city: string;
  country: string;
  event_interest: string;
  sub_pipeline: string;
  package_tier: string;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string;
  next_followup_at: string;
  deal_value: string;
  deal_currency: Currency;
  notes: string;
}

const EMPTY_FORM: FormState = {
  full_name: "",
  email: "",
  phone: "",
  company: "",
  designation: "",
  linkedin_url: "",
  city: "",
  country: "",
  event_interest: "",
  sub_pipeline: "",
  package_tier: "",
  source: "WEBSITE_FORM",
  status: "LEAD_ASSIGNED",
  assigned_to: "",
  next_followup_at: "",
  deal_value: "",
  deal_currency: "INR",
  notes: "",
};

function fromLead(lead: LeadDetail): FormState {
  return {
    full_name: lead.full_name,
    email: lead.email ?? "",
    phone: lead.phone,
    company: lead.company ?? "",
    designation: lead.designation ?? "",
    linkedin_url: lead.linkedin_url ?? "",
    city: lead.city ?? "",
    country: lead.country ?? "",
    event_interest: lead.event_interest != null ? String(lead.event_interest) : "",
    sub_pipeline: lead.sub_pipeline != null ? String(lead.sub_pipeline) : "",
    package_tier: lead.package_tier != null ? String(lead.package_tier) : "",
    source: lead.source,
    status: lead.status,
    assigned_to: lead.assigned_to != null ? String(lead.assigned_to) : "",
    // datetime-local needs `YYYY-MM-DDTHH:mm` (no seconds, no TZ).
    next_followup_at: lead.next_followup_at ? lead.next_followup_at.slice(0, 16) : "",
    deal_value: lead.deal_value ?? "",
    deal_currency: lead.deal_currency ?? "INR",
    notes: lead.notes ?? "",
  };
}

function toPayload(form: FormState): LeadWritePayload {
  return {
    full_name: form.full_name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    company: form.company.trim(),
    designation: form.designation.trim(),
    linkedin_url: form.linkedin_url.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
    event_interest: form.event_interest ? Number(form.event_interest) : undefined,
    sub_pipeline: form.sub_pipeline ? Number(form.sub_pipeline) : undefined,
    package_tier: form.package_tier ? Number(form.package_tier) : null,
    source: form.source,
    status: form.status,
    assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
    next_followup_at: form.next_followup_at || null,
    deal_value: form.deal_value.trim() || null,
    deal_currency: form.deal_currency,
    notes: form.notes,
  };
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.full_name.trim()) errors.full_name = "Required.";
  if (!form.phone.trim()) errors.phone = "Required.";
  if (!form.event_interest) errors.event_interest = "Pick an event.";
  if (!form.sub_pipeline) errors.sub_pipeline = "Pick a sub-pipeline.";
  if (form.deal_value && Number.isNaN(Number(form.deal_value))) {
    errors.deal_value = "Must be a number.";
  }
  return errors;
}

function describeAxiosError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return "Can't reach the server. Is the backend running?";
    const data = e.response.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      // DRF returns {field: [msg]} or {detail: msg}. Surface the first useful one.
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
  return "Unexpected error.";
}

export interface LeadFormProps {
  mode: "create" | "edit";
  initial?: LeadDetail;
  events: ApiEvent[];
  users: AdminUser[] | null;
  currentUser: User | null;
  /** Resolves with the updated/created lead on success. Throws on error. */
  onSubmit: (payload: LeadWritePayload) => Promise<LeadDetail>;
  /** Optional callback after a successful save (e.g. navigate, refresh). */
  onSaved?: (lead: LeadDetail) => void;
}

export function LeadForm({
  mode,
  initial,
  events,
  users,
  currentUser,
  onSubmit,
  onSaved,
}: LeadFormProps) {
  const [form, setForm] = useState<FormState>(initial ? fromLead(initial) : EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Status-change confirm modal: only relevant in edit mode.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allTiers, setAllTiers] = useState<PackageTier[] | null>(null);
  const [allSubPipelines, setAllSubPipelines] = useState<SubPipeline[] | null>(null);
  const [pickedContact, setPickedContact] = useState<Contact | null>(null);

  // One-shot cache fetch on mount. Both lists are small (~15 sub-pipelines
  // and ~63 tiers on the seeded data), so we cache them client-side and
  // cascade entirely in-memory. Phase 2.9 made these admin-managed so the
  // cache is refreshed on every form mount — that's the right cadence.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.tiers.list({ is_active: true }).catch(() => [] as PackageTier[]),
      api.subPipelines.list({ is_active: true }).catch(() => [] as SubPipeline[]),
    ]).then(([tiersRes, spRes]) => {
      if (cancelled) return;
      setAllTiers(tiersRes);
      setAllSubPipelines(spRes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const eventOptions: SelectOption[] = useMemo(
    () =>
      events.map((e) => ({
        value: String(e.id),
        label: `${e.city} — ${e.name}`,
      })),
    [events],
  );

  // Sub-pipelines filtered to the chosen event. Empty array when no event
  // picked yet — the dropdown then renders disabled with a hint.
  const subPipelineOptions: SelectOption[] = useMemo(() => {
    if (!allSubPipelines || !form.event_interest) return [];
    const eventId = Number(form.event_interest);
    const scoped = allSubPipelines.filter((sp) => sp.event === eventId);
    return [
      { value: "", label: "— Select sub-pipeline —" },
      ...sortSubPipelines(scoped).map((sp) => ({
        value: String(sp.id),
        label: sp.name,
      })),
    ];
  }, [allSubPipelines, form.event_interest]);

  const tierOptions: SelectOption[] = useMemo(() => {
    if (!allTiers || !form.sub_pipeline) return [];
    const subPipelineId = Number(form.sub_pipeline);
    return [
      { value: "", label: "— No tier —" },
      ...allTiers
        .filter((t) => t.sub_pipeline === subPipelineId)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((t) => {
          const inr = t.default_price_inr ? `₹${Number(t.default_price_inr).toLocaleString()}` : null;
          const usd = t.default_price_usd ? `$${Number(t.default_price_usd).toLocaleString()}` : null;
          const pricePart = inr || usd ? ` — ${[inr, usd].filter(Boolean).join(" / ")}` : "";
          return { value: String(t.id), label: `${t.name}${pricePart}` };
        }),
    ];
  }, [allTiers, form.sub_pipeline]);

  const assigneeOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: "", label: "Unassigned" }];
    const seen = new Set<string>();
    if (currentUser) {
      opts.push({ value: String(currentUser.id), label: `${currentUser.username} (me)` });
      seen.add(String(currentUser.id));
    }
    if (users) {
      for (const u of users) {
        if (!u.is_active) continue;
        const v = String(u.id);
        if (seen.has(v)) continue;
        opts.push({ value: v, label: u.username });
      }
    } else if (initial?.assigned_to && !seen.has(String(initial.assigned_to))) {
      // Non-admin can't list users — keep the existing assignee visible by username.
      opts.push({
        value: String(initial.assigned_to),
        label: initial.assigned_to_username ?? `User #${initial.assigned_to}`,
      });
    }
    return opts;
  }, [users, currentUser, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const statusChanged = mode === "edit" && initial && form.status !== initial.status;

  async function doSubmit(comment?: string) {
    setSaving(true);
    setServerError(null);
    try {
      const payload = toPayload(form);
      if (statusChanged && comment) payload.status_change_comment = comment;
      const saved = await onSubmit(payload);
      onSaved?.(saved);
    } catch (e) {
      setServerError(describeAxiosError(e));
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    if (statusChanged) {
      // Backend requires status_change_comment whenever status flips. Open the modal.
      setConfirmOpen(true);
      return;
    }
    await doSubmit();
  }

  function handlePickContact(c: Contact) {
    setPickedContact(c);
    setForm((prev) => ({
      ...prev,
      full_name: c.full_name || prev.full_name,
      phone: c.phone || prev.phone,
      email: c.email || prev.email,
      company: c.company || prev.company,
      designation: c.designation || prev.designation,
      linkedin_url: c.linkedin_url || prev.linkedin_url,
      source: c.source || prev.source,
    }));
    setErrors((prev) => ({ ...prev, full_name: undefined, phone: undefined }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mode === "create" && (
        <ContactPicker
          picked={pickedContact}
          onPick={handlePickContact}
          onClear={() => setPickedContact(null)}
        />
      )}
      {serverError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-4 py-3 text-sm">
          {serverError}
        </div>
      )}

      <Card title="Contact" description="Who is this prospect?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full name *"
            name="full_name"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            error={errors.full_name}
            autoComplete="off"
          />
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
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
          />
          <Input
            label="LinkedIn URL"
            name="linkedin_url"
            value={form.linkedin_url}
            onChange={(e) => set("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/…"
            autoComplete="off"
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
          <Input
            label="City"
            name="city"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
          <Input
            label="Country"
            name="country"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </div>
      </Card>

      <Card title="Interest" description="What are they looking at?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Event *"
            name="event_interest"
            value={form.event_interest}
            onChange={(e) => {
              const next = e.target.value;
              // Cascade: changing the event invalidates the sub-pipeline (which
              // is event-scoped) and the tier (which lives under the sub-pipeline).
              setForm((prev) => ({
                ...prev,
                event_interest: next,
                sub_pipeline: "",
                package_tier: "",
              }));
              setErrors((prev) => ({ ...prev, event_interest: undefined }));
            }}
            options={eventOptions}
            placeholder="Select event…"
            error={errors.event_interest}
          />
          <Select
            label="Sub-pipeline *"
            name="sub_pipeline"
            value={form.sub_pipeline}
            onChange={(e) => {
              const next = e.target.value;
              // Cascade: changing the sub-pipeline invalidates the tier.
              setForm((prev) => ({
                ...prev,
                sub_pipeline: next,
                package_tier: "",
              }));
              setErrors((prev) => ({ ...prev, sub_pipeline: undefined }));
            }}
            options={subPipelineOptions}
            disabled={allSubPipelines == null || !form.event_interest}
            error={errors.sub_pipeline}
            hint={
              !form.event_interest
                ? "Pick an event first."
                : allSubPipelines && subPipelineOptions.length <= 1
                  ? "No sub-pipelines configured for this event yet."
                  : undefined
            }
          />
          <Select
            label="Tier / Package"
            name="package_tier"
            value={form.package_tier}
            onChange={(e) => set("package_tier", e.target.value)}
            options={tierOptions}
            disabled={allTiers == null || !form.sub_pipeline}
            hint={
              !form.sub_pipeline
                ? "Pick a sub-pipeline first."
                : allTiers && tierOptions.length <= 1
                  ? "No tiers configured for this sub-pipeline yet."
                  : undefined
            }
          />
          <Select
            label="Source"
            name="source"
            value={form.source}
            onChange={(e) => set("source", e.target.value as LeadSource)}
            options={SOURCE_OPTIONS}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Deal value
            </label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                {(["INR", "USD"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("deal_currency", c)}
                    className={`px-3 py-2 font-medium transition-colors ${
                      form.deal_currency === c
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {CURRENCY_SYMBOL[c]}
                  </button>
                ))}
              </div>
              <input
                name="deal_value"
                value={form.deal_value}
                onChange={(e) => set("deal_value", e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 50000"
                className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            {errors.deal_value && (
              <p className="mt-1 text-xs text-rose-600">{errors.deal_value}</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Pipeline" description="Where does this lead sit, and who owns it?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Status"
            name="status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as LeadStatus)}
            options={STATUS_OPTIONS}
            hint={
              statusChanged && initial
                ? `Changing from ${STATUS_LABEL[initial.status]} → ${STATUS_LABEL[form.status]}. You'll be asked for a comment on save.`
                : undefined
            }
          />
          <Select
            label="Assigned to"
            name="assigned_to"
            value={form.assigned_to}
            onChange={(e) => set("assigned_to", e.target.value)}
            options={assigneeOptions}
          />
          <Input
            label="Next follow-up"
            name="next_followup_at"
            type="datetime-local"
            value={form.next_followup_at}
            onChange={(e) => set("next_followup_at", e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            placeholder="Anything important about this lead…"
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" loading={saving} leftIcon={<Save className="w-4 h-4" />}>
          {mode === "create" ? "Create lead" : "Save changes"}
        </Button>
      </div>

      {initial && confirmOpen && (
        <StatusChangeModal
          open
          leadName={initial.full_name}
          fromStatus={initial.status}
          toStatus={form.status}
          saving={saving}
          onCancel={() => !saving && setConfirmOpen(false)}
          onConfirm={(comment) => doSubmit(comment)}
        />
      )}
    </form>
  );
}
