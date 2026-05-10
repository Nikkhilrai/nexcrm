"use client";

import { useEffect, useState } from "react";
import axios from "axios";

import { Button, Modal, Spinner } from "@/components/ui";
import { api, type EmailPreviewResponse, type EmailTemplate, type LeadListItem } from "@/lib/api";

interface Props {
  open: boolean;
  template: EmailTemplate | null;
  onClose: () => void;
}

export function PreviewModal({ open, template, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);
  const [preview, setPreview] = useState<EmailPreviewResponse | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setLeads([]);
      setSelectedLead(null);
      setPreview(null);
      setError(null);
    }
  }, [open]);

  // Debounced lead search
  useEffect(() => {
    if (!open || search.length < 2) {
      setLeads([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingLeads(true);
      try {
        const page = await api.leads.list({ search });
        setLeads(page.results.slice(0, 6));
      } catch {
        setLeads([]);
      } finally {
        setLoadingLeads(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, open]);

  async function pickLead(lead: LeadListItem) {
    setSelectedLead(lead);
    setLeads([]);
    setSearch(lead.full_name);
    if (!template) return;
    setLoadingPreview(true);
    setPreview(null);
    setError(null);
    try {
      const result = await api.emails.previewTemplate(template.id, lead.id);
      setPreview(result);
    } catch (e) {
      setError(
        axios.isAxiosError(e) && e.response?.data?.detail
          ? e.response.data.detail
          : "Couldn't load preview.",
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview — ${template?.name ?? ""}`}
      description="Search for a lead to see how the merge tags will render for them."
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {/* Lead search */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Search lead
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedLead(null); setPreview(null); }}
            placeholder="Type a name, company, or phone…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {loadingLeads && (
            <div className="absolute right-3 top-9">
              <Spinner size="sm" />
            </div>
          )}
          {leads.length > 0 && (
            <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {leads.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => pickLead(l)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <span>
                      <span className="font-medium text-slate-900">{l.full_name}</span>
                      {l.company && <span className="text-slate-500"> · {l.company}</span>}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{l.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Preview output */}
        {loadingPreview && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" label="Rendering preview…" />
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {preview && selectedLead && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">
                To
              </div>
              <div className="px-4 py-2 text-sm text-slate-800">
                {selectedLead.full_name}
                <span className="text-slate-500 ml-1">{selectedLead.phone}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">
                Subject
              </div>
              <div className="px-4 py-2 text-sm font-medium text-slate-900">
                {preview.subject}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wide">
                Body
              </div>
              <div
                className="px-4 py-3 text-sm text-slate-800 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.body_html }}
              />
            </div>
          </div>
        )}

        {!selectedLead && !loadingPreview && (
          <p className="text-sm text-slate-500 text-center py-4">
            Search and pick a lead above to see the rendered email.
          </p>
        )}
      </div>
    </Modal>
  );
}
