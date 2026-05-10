"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";

import { Badge, Button, Card, Spinner } from "@/components/ui";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmailsNav } from "@/app/(authed)/admin/email-templates/components/EmailsNav";
import { api, type EmailRule, type EmailTemplate } from "@/lib/api";

import { RuleFormModal } from "./components/RuleFormModal";

function delayLabel(hours: number): string {
  if (hours === 0) return "Immediately";
  if (hours === 1) return "After 1 hour";
  if (hours < 24) return `After ${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem === 0 ? `After ${days}d` : `After ${days}d ${rem}h`;
}

export default function EmailRulesPage() {
  const [rules, setRules] = useState<EmailRule[] | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailRule | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  function load() {
    setError(null);
    setRules(null);
    Promise.all([api.emails.listRules(), api.emails.listTemplates()])
      .then(([r, t]) => { setRules(r); setTemplates(t); })
      .catch(() => setError("Couldn't load rules."));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(r: EmailRule) {
    setEditing(r);
    setFormOpen(true);
  }

  function handleSaved(saved: EmailRule) {
    setFormOpen(false);
    setRules((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
  }

  async function toggleActive(r: EmailRule) {
    setTogglingId(r.id);
    try {
      const updated = await api.emails.updateRule(r.id, { is_active: !r.is_active });
      setRules((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);
    } catch {
      window.alert("Couldn't toggle rule.");
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteRule(r: EmailRule) {
    if (!window.confirm(`Delete rule "${r.name}"?\n\nAny emails already queued by this rule will not be cancelled.`)) return;
    setDeletingId(r.id);
    try {
      await api.emails.deleteRule(r.id);
      setRules((prev) => prev?.filter((x) => x.id !== r.id) ?? prev);
    } catch (e) {
      const msg = axios.isAxiosError(e) && e.response?.data?.detail
        ? e.response.data.detail
        : "Couldn't delete rule.";
      window.alert(msg);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl text-ink-900">Email Automation</h1>
          <EmailsNav />
          <p className="text-sm text-slate-600">
            Rules fire automatically when a lead moves to the trigger status. Multiple rules can share the same trigger.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          New rule
        </Button>
      </div>

      {/* How it works callout */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex gap-3 items-start">
        <Zap className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600">
          When an SDR moves a lead to the trigger status, the rule instantly queues an email. A background job picks it up within 60 seconds (or after the delay you set) and delivers it.
        </p>
      </div>

      {/* Content */}
      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      ) : rules === null ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading rules…" />
        </div>
      ) : rules.length === 0 ? (
        <Card
          title="No trigger rules yet"
          description="Hit '+ New rule' to set up your first automated email trigger."
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Rule</th>
                  <th className="text-left font-semibold px-4 py-3">When status becomes</th>
                  <th className="text-left font-semibold px-4 py-3">Send template</th>
                  <th className="text-left font-semibold px-4 py-3">Timing</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="w-28 px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${!r.is_active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink-900">{r.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={r.trigger_status} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.template_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.delay_hours === 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {delayLabel(r.delay_hours)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(r)}
                        disabled={togglingId === r.id}
                        className="disabled:opacity-50"
                        title={r.is_active ? "Click to deactivate" : "Click to activate"}
                      >
                        <Badge tone={r.is_active ? "emerald" : "neutral"}>
                          {r.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit rule"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRule(r)}
                          disabled={deletingId === r.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40"
                          title="Delete rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RuleFormModal
        open={formOpen}
        initial={editing}
        templates={templates}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
