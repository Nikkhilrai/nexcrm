"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

import {
  Button,
  Input,
  Modal,
  Select,
  type SelectOption,
} from "@/components/ui";
import {
  api,
  type AdminUser,
  type CreateUserPayload,
  type Role,
  type UpdateUserPayload,
} from "@/lib/api";

const ROLE_OPTIONS: SelectOption[] = [
  { value: "USER", label: "User (caller)" },
  { value: "ADMIN", label: "Admin" },
];

interface UserFormModalProps {
  open: boolean;
  /** `null` → create mode, otherwise edit. */
  initial: AdminUser | null;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
}

interface FormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: Role;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  role: "USER",
  is_active: true,
};

function describeAxiosError(e: unknown): string {
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
  return "Unexpected error.";
}

export function UserFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const isEdit = initial !== null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setForm({
        username: initial.username,
        email: initial.email ?? "",
        first_name: initial.first_name ?? "",
        last_name: initial.last_name ?? "",
        password: "",
        role: initial.role,
        is_active: initial.is_active,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let saved: AdminUser;
      if (isEdit && initial) {
        const payload: UpdateUserPayload = {
          username: form.username.trim(),
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
          is_active: form.is_active,
        };
        // Only send password if the admin actually typed one — backend skips
        // re-hashing when the field is omitted.
        if (form.password) payload.password = form.password;
        saved = await api.users.update(initial.id, payload);
      } else {
        if (!form.password) {
          setError("Password is required for new users.");
          setSaving(false);
          return;
        }
        const payload: CreateUserPayload = {
          username: form.username.trim(),
          email: form.email.trim() || undefined,
          first_name: form.first_name.trim() || undefined,
          last_name: form.last_name.trim() || undefined,
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        };
        saved = await api.users.create(payload);
      }
      onSaved(saved);
    } catch (e) {
      setError(describeAxiosError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={isEdit ? `Edit ${initial?.username}` : "New user"}
      description={
        isEdit
          ? "Leave password blank to keep the current one."
          : "Admin creates accounts directly — no email verification."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="user-form" type="submit" loading={saving}>
            {isEdit ? "Save" : "Create user"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Username *"
            name="username"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            autoComplete="off"
            required
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
            label="First name"
            name="first_name"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
          <Input
            label="Last name"
            name="last_name"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
          <Input
            label={isEdit ? "New password (optional)" : "Password *"}
            name="password"
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
            placeholder={isEdit ? "Leave blank to keep" : ""}
          />
          <Select
            label="Role"
            name="role"
            value={form.role}
            onChange={(e) => set("role", e.target.value as Role)}
            options={ROLE_OPTIONS}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="w-4 h-4 accent-brand-500"
          />
          Active — can log in
        </label>
      </form>
    </Modal>
  );
}
