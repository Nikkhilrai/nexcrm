"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

import { Button, Input, Modal } from "@/components/ui";
import {
  api,
  type PackageTier,
  type SubPipeline,
  type TierWritePayload,
} from "@/lib/api";

interface TierFormModalProps {
  open: boolean;
  /** Edit target. `null` → create mode. */
  initial: PackageTier | null;
  /** Sub-pipeline the new tier belongs to (create mode). Locked in edit. */
  subPipeline: SubPipeline | null;
  onClose: () => void;
  onSaved: (tier: PackageTier) => void;
}

interface FormState {
  name: string;
  default_price_inr: string;
  default_price_usd: string;
  sort_order: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  default_price_inr: "",
  default_price_usd: "",
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

export function TierFormModal({
  open,
  initial,
  subPipeline,
  onClose,
  onSaved,
}: TierFormModalProps) {
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
            default_price_inr: initial.default_price_inr ?? "",
            default_price_usd: initial.default_price_usd ?? "",
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
    if (form.default_price_inr && Number.isNaN(Number(form.default_price_inr))) {
      setError("Default price (₹) must be a number, or leave blank.");
      return;
    }
    if (form.default_price_usd && Number.isNaN(Number(form.default_price_usd))) {
      setError("Default price ($) must be a number, or leave blank.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const targetSpId = isEdit && initial ? initial.sub_pipeline : subPipeline?.id;
      if (!targetSpId) {
        setError("No sub-pipeline scope.");
        setSaving(false);
        return;
      }
      const payload: TierWritePayload = {
        sub_pipeline: targetSpId,
        name: form.name.trim(),
        default_price_inr: form.default_price_inr.trim() || null,
        default_price_usd: form.default_price_usd.trim() || null,
        sort_order: sortOrderNum,
        is_active: form.is_active,
      };
      const saved =
        isEdit && initial
          ? await api.tiers.update(initial.id, payload)
          : await api.tiers.create(payload);
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
      title={isEdit ? `Edit "${initial?.name}"` : "New tier"}
      description={
        isEdit
          ? "Sub-pipeline can't be changed — would orphan existing leads. Edit name, prices, order, and active state."
          : `Adding a new tier under "${subPipeline?.name ?? "…"}".`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="tier-form" type="submit" loading={saving}>
            {isEdit ? "Save" : "Create tier"}
          </Button>
        </>
      }
    >
      <form id="tier-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <Input
          label="Sub-pipeline"
          name="sp_label"
          value={subPipeline?.name ?? "Loading…"}
          disabled
          readOnly
        />
        <Input
          label="Tier name *"
          name="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          autoComplete="off"
          placeholder="e.g. Bronze Sponsor"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Default price (₹)"
            name="default_price_inr"
            value={form.default_price_inr}
            onChange={(e) => set("default_price_inr", e.target.value)}
            inputMode="decimal"
            placeholder="Blank for in-kind / free"
            hint="Suggested deal_value for INR deals."
          />
          <Input
            label="Default price ($)"
            name="default_price_usd"
            value={form.default_price_usd}
            onChange={(e) => set("default_price_usd", e.target.value)}
            inputMode="decimal"
            placeholder="Blank if not applicable"
            hint="Suggested deal_value for USD deals."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Sort order"
            name="sort_order"
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => set("sort_order", e.target.value)}
            hint="Lower = higher in the dropdown."
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Active — appears in the Lead form dropdown
        </label>
      </form>
    </Modal>
  );
}
