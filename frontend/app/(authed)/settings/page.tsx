"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";

import { Button, Card, Spinner } from "@/components/ui";
import { api, type UserEmailCredential } from "@/lib/api";

export default function SettingsPage() {
  const [credential, setCredential] = useState<UserEmailCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);

  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.emails.getMyCredential()
      .then((cred) => {
        setCredential(cred);
        setEmail(cred.zoho_email);
      })
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setNotConfigured(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    if (!credential && !appPassword.trim()) { setError("App password is required for first-time setup."); return; }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: { zoho_email?: string; app_password?: string } = { zoho_email: email };
      if (appPassword.trim()) payload.app_password = appPassword;
      const updated = await api.emails.updateMyCredential(payload);
      setCredential(updated);
      setEmail(updated.zoho_email);
      setAppPassword("");
      setNotConfigured(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal preferences and email configuration.
        </p>
      </div>

      <Card
        title="Email credentials"
        description="Used to send outbound emails from your company Gmail account."
      >
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Spinner size="sm" /> Loading…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {notConfigured && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
                <KeyRound className="w-4 h-4 inline mr-1.5" />
                No email credential configured yet. Add your Gmail address and App Password below.
              </div>
            )}

            {saved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved successfully.
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gmail address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Emails to leads will show this as the sender address.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gmail App Password {credential ? "(leave blank to keep current)" : "*"}
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder={credential ? "••••••••••••••••" : "xxxx xxxx xxxx xxxx"}
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
                Generate at{" "}
                <span className="font-medium">Google Account → Security → 2-Step Verification → App passwords</span>.
                Use the 16-character code (spaces optional).
              </p>
            </div>

            {credential && (
              <div className="text-xs text-slate-400">
                Last updated: {new Date(credential.updated_at).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button type="submit" loading={saving}>
                {credential ? "Update credentials" : "Save credentials"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
