"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Pencil, Trash2, Eye, Mail } from "lucide-react";

import { Badge, Button, Card, Spinner } from "@/components/ui";
import { api, type EmailTemplate } from "@/lib/api";

import { EmailsNav } from "./components/EmailsNav";
import { PreviewModal } from "./components/PreviewModal";
import { TemplateFormModal } from "./components/TemplateFormModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  function load() {
    setError(null);
    setTemplates(null);
    api.emails
      .listTemplates()
      .then(setTemplates)
      .catch(() => setError("Couldn't load email templates."));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(t: EmailTemplate) {
    setEditing(t);
    setFormOpen(true);
  }

  function handleSaved(saved: EmailTemplate) {
    setFormOpen(false);
    setTemplates((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
  }

  async function toggleActive(t: EmailTemplate) {
    setTogglingId(t.id);
    try {
      const updated = await api.emails.updateTemplate(t.id, { is_active: !t.is_active });
      setTemplates((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);
    } catch {
      window.alert("Couldn't toggle template.");
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteTemplate(t: EmailTemplate) {
    if (t.rules_count > 0) {
      window.alert(
        `This template has ${t.rules_count} active rule(s). Deactivate those rules first.`,
      );
      return;
    }
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    setDeletingId(t.id);
    try {
      await api.emails.deleteTemplate(t.id);
      setTemplates((prev) => prev?.filter((x) => x.id !== t.id) ?? prev);
    } catch (e) {
      const msg = axios.isAxiosError(e) && e.response?.data?.detail
        ? e.response.data.detail
        : "Couldn't delete template.";
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
            Build reusable templates with merge tags. Attach them to trigger rules or send manually from any lead.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          New template
        </Button>
      </div>

      {/* Merge-tag reference card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">
          Available merge tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "lead_name", "lead_first_name", "lead_company", "lead_designation",
            "lead_email", "event_name", "event_city", "event_location", "event_date",
            "pipeline_name", "tier_name", "sender_name",
          ].map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-white text-amber-900 border border-amber-300"
            >
              {`{{${tag}}}`}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      ) : templates === null ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading templates…" />
        </div>
      ) : templates.length === 0 ? (
        <Card
          title="No templates yet"
          description="Hit '+ New template' to create your first email template."
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Template</th>
                  <th className="text-left font-semibold px-4 py-3">Subject</th>
                  <th className="text-left font-semibold px-4 py-3">Rules</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Created</th>
                  <th className="w-36 px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-ink-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">
                      <span className="line-clamp-1" title={t.subject}>{t.subject}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.rules_count > 0 ? (
                        <Badge tone="blue">{t.rules_count} rule{t.rules_count !== 1 ? "s" : ""}</Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(t)}
                        disabled={togglingId === t.id}
                        className="disabled:opacity-50"
                        title={t.is_active ? "Click to deactivate" : "Click to activate"}
                      >
                        <Badge tone={t.is_active ? "emerald" : "neutral"}>
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(t.created_at)}
                      {t.created_by_username && (
                        <div className="text-slate-400">by {t.created_by_username}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setPreviewing(t)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Preview with a lead"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit template"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(t)}
                          disabled={deletingId === t.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40"
                          title={t.rules_count > 0 ? "Has active rules — deactivate rules first" : "Delete template"}
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

      <TemplateFormModal
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <PreviewModal
        open={previewing !== null}
        template={previewing}
        onClose={() => setPreviewing(null)}
      />
    </div>
  );
}
