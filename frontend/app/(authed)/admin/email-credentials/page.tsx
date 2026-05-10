"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { Plus, Trash2, Eye, EyeOff, KeyRound } from "lucide-react";

import { Badge, Button, Card, Modal, Spinner } from "@/components/ui";
import { api, type AdminUser, type UserEmailCredential } from "@/lib/api";
import { EmailsNav } from "../email-templates/components/EmailsNav";

// ─── Add / Edit Credential Modal ──────────────────────────────────────────────

interface CredentialModalProps {
  open: boolean;
  users: AdminUser[];
  existing: UserEmailCredential | null;
  onClose: () => void;
  onSaved: () => void;
}

function CredentialModal({ open, users, existing, onClose, onSaved }: CredentialModalProps) {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setUserId(""); setEmail(""); setAppPassword(""); setError(null); setShowPwd(false); return; }
    if (existing) setEmail(existing.zoho_email);
  }, [open, existing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    if (!existing && (!userId || !appPassword.trim())) {
      setError("User and App Password are required."); return;
    }
    setSaving(true);
    setError(null);
    try {
      if (existing) {
        const payload: { zoho_email?: string; app_password?: string } = { zoho_email: email };
        if (appPassword.trim()) payload.app_password = appPassword;
        await api.emails.updateCredential(existing.id, payload);
      } else {
        await api.emails.createCredential({
          user: Number(userId),
          zoho_email: email,
          app_password: appPassword,
        });
      }
      onSaved();
    } catch (e) {
      const msg = axios.isAxiosError(e) && e.response?.data
        ? (() => {
            const d = e.response!.data as Record<string, unknown>;
            if (typeof d.detail === "string") return d.detail;
            const [k, v] = Object.entries(d)[0] ?? [];
            return k ? `${k}: ${Array.isArray(v) ? v.join(" ") : v}` : "Save failed.";
          })()
        : "Save failed.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={existing ? `Edit — ${existing.username}` : "Add SDR credential"}
      description="Gmail App Password used to send emails from this SDR's account."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button form="cred-form" type="submit" loading={saving}>Save</Button>
        </>
      }
    >
      <form id="cred-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {!existing && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SDR user *</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}{u.first_name || u.last_name ? ` — ${u.first_name} ${u.last_name}`.trim() : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Gmail address *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sdr@yourdomain.com"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            App Password {existing ? "(leave blank to keep current)" : "*"}
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder={existing ? "••••••••••••••••" : "xxxx xxxx xxxx xxxx"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            16-char code from Google Account → Security → App passwords.
          </p>
        </div>
      </form>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailCredentialsPage() {
  const [credentials, setCredentials] = useState<UserEmailCredential[] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserEmailCredential | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setCredentials(null);
    setLoadError(null);
    Promise.all([api.emails.listCredentials(), api.users.list()])
      .then(([creds, us]) => { setCredentials(creds); setUsers(us); })
      .catch(() => setLoadError("Couldn't load credentials."));
  }

  useEffect(load, []);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(cred: UserEmailCredential) { setEditing(cred); setModalOpen(true); }

  async function remove(cred: UserEmailCredential) {
    if (!window.confirm(`Remove credential for ${cred.username}? They won't be able to send emails.`)) return;
    setDeletingId(cred.id);
    try {
      await api.emails.deleteCredential(cred.id);
      setCredentials((prev) => prev?.filter((c) => c.id !== cred.id) ?? prev);
    } catch {
      window.alert("Couldn't delete credential.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Email Automation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Templates, trigger rules, and per-SDR Gmail credentials.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add credential
        </Button>
      </div>

      <EmailsNav />

      {loadError ? (
        <p className="text-sm text-rose-700">{loadError}</p>
      ) : credentials === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Spinner size="sm" /> Loading…
        </div>
      ) : credentials.length === 0 ? (
        <Card title="No credentials yet">
          <div className="text-center py-6 space-y-2">
            <KeyRound className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500">
              Add a Gmail App Password for each SDR so the system can send emails from their account.
            </p>
            <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add first credential
            </Button>
          </div>
        </Card>
      ) : (
        <Card title={`${credentials.length} SDR credential${credentials.length === 1 ? "" : "s"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-3 pr-4 font-medium text-slate-600">User</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Gmail address</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Status</th>
                  <th className="pb-3 pr-4 font-medium text-slate-600">Updated</th>
                  <th className="pb-3 font-medium text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-ink-900">{cred.username}</td>
                    <td className="py-3 pr-4 text-slate-600 font-mono text-xs">{cred.zoho_email}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={cred.is_active ? "emerald" : "neutral"}>
                        {cred.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {new Date(cred.updated_at).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(cred)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(cred)}
                          disabled={deletingId === cred.id}
                          className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CredentialModal
        open={modalOpen}
        users={users}
        existing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}
