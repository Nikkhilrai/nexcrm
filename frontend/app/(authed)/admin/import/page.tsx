"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import axios from "axios";
import { CheckCircle2, Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";

import { Button, Card, Input, Spinner } from "@/components/ui";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useIntersection } from "@/lib/hooks/useIntersection";
import { api, type BulkUploadResponse, type Contact } from "@/lib/api";

import { ContactFormModal } from "./components/ContactFormModal";

type Step = "idle" | "previewing" | "preview-ready" | "confirming" | "done";

export default function AdminImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkUploadResponse | null>(null);
  const [finalResult, setFinalResult] = useState<BulkUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function describeError(e: unknown): string {
    if (axios.isAxiosError(e)) {
      if (!e.response) return "Can't reach the server.";
      if (e.response.status === 403) return "Admin only.";
      const data = e.response.data;
      if (data && typeof data === "object" && "file" in data) {
        return String((data as { file: unknown }).file);
      }
      return `Upload failed (${e.response.status}).`;
    }
    return "Upload failed.";
  }

  async function handleFile(picked: File) {
    setError(null);
    setPreview(null);
    setFinalResult(null);
    if (!picked.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx files are supported.");
      return;
    }
    setFile(picked);
    setStep("previewing");
    try {
      const data = await api.contacts.bulkUpload(picked, { dryRun: true });
      setPreview(data);
      setStep("preview-ready");
    } catch (e) {
      setError(describeError(e));
      setStep("idle");
    }
  }

  const [directoryReloadKey, setDirectoryReloadKey] = useState(0);

  async function confirmImport() {
    if (!file) return;
    setError(null);
    setStep("confirming");
    try {
      const data = await api.contacts.bulkUpload(file);
      setFinalResult(data);
      setStep("done");
      setDirectoryReloadKey((k) => k + 1);
    } catch (e) {
      setError(describeError(e));
      setStep("preview-ready");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setFinalResult(null);
    setError(null);
    setStep("idle");
  }

  function onDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    try {
      await api.contacts.downloadTemplate();
    } catch {
      setError("Couldn't download the template.");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  const dropzoneDisabled = step === "previewing" || step === "confirming" || step === "preview-ready";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink-900">Import contacts</h1>
          <p className="text-sm text-slate-600">
            Drop a .xlsx of contacts, preview what will be imported, then confirm.
            Email is required; everything else is optional. Emails already in the
            contacts database are skipped automatically.
          </p>
        </div>
        <Button
          variant="secondary"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={downloadTemplate}
          loading={downloadingTemplate}
        >
          Download template
        </Button>
      </div>

      {step !== "done" && (
        <Card padding="none">
          <label
            htmlFor="contact-upload"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={[
              "block rounded-xl border-2 border-dashed transition-colors px-6 py-12 text-center",
              dropzoneDisabled
                ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
                : dragOver
                  ? "border-brand-500 bg-brand-50 cursor-pointer"
                  : "border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50 cursor-pointer",
            ].join(" ")}
          >
            <input
              id="contact-upload"
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              disabled={dropzoneDisabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-col items-center gap-2">
              {step === "previewing" ? (
                <Spinner size="lg" label="Parsing file…" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-brand-600" />
                  <p className="text-sm font-medium text-ink-900">
                    Drop a .xlsx file here, or click to choose
                  </p>
                  <p className="text-xs text-slate-500">
                    Columns: Email (required), Name, Phone, Company, Designation, LinkedIn URL, Source
                  </p>
                </>
              )}
            </div>
          </label>
        </Card>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* PREVIEW phase */}
      {preview && step === "preview-ready" && (
        <PreviewSummary
          fileName={file?.name ?? null}
          data={preview}
          onConfirm={confirmImport}
          onCancel={reset}
        />
      )}

      {/* In-flight final import */}
      {step === "confirming" && (
        <Card padding="tight">
          <div className="flex items-center gap-3 text-sm">
            <Spinner size="sm" /> <span className="text-slate-700">Importing…</span>
          </div>
        </Card>
      )}

      {/* DONE phase */}
      {finalResult && step === "done" && (
        <FinalResult
          fileName={file?.name ?? null}
          data={finalResult}
          onUploadAnother={reset}
        />
      )}

      <ContactsDirectory reloadKey={directoryReloadKey} />
    </div>
  );
}

// ─── Preview ─────────────────────────────────────────────────

function PreviewSummary({
  fileName,
  data,
  onConfirm,
  onCancel,
}: {
  fileName: string | null;
  data: BulkUploadResponse;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card
      title="Preview"
      description={fileName ? `${fileName} — review the rows below before importing.` : undefined}
      padding="none"
    >
      <div className="px-6 py-4 flex items-center gap-6 border-b border-slate-200 text-sm">
        <Stat
          color="emerald"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          value={data.would_import}
          label="will import"
        />
        <Stat color="rose" icon={<X className="w-4 h-4" />} value={data.skipped.length} label="will skip" />
      </div>

      {data.preview.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Email</th>
                <th className="text-left font-semibold px-4 py-2.5">Name</th>
                <th className="text-left font-semibold px-4 py-2.5 w-44">Phone</th>
                <th className="text-left font-semibold px-4 py-2.5">Company</th>
                <th className="text-left font-semibold px-4 py-2.5">Designation</th>
                <th className="text-left font-semibold px-4 py-2.5 w-24">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.preview.map((row, idx) => (
                <tr key={`${row.email}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 truncate max-w-xs">
                    {row.email || <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-900">
                    {row.full_name || <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                    {row.phone || <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {row.company || <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {row.designation || <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-6 text-sm text-slate-500 italic text-center">
          No rows would be imported from this file.
        </div>
      )}

      {data.skipped.length > 0 && <SkippedTable skipped={data.skipped} title="Will be skipped" />}

      <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          leftIcon={<CheckCircle2 className="w-4 h-4" />}
          disabled={data.would_import === 0}
        >
          Confirm import ({data.would_import})
        </Button>
      </div>
    </Card>
  );
}

// ─── Final result ───────────────────────────────────────────

function FinalResult({
  fileName,
  data,
  onUploadAnother,
}: {
  fileName: string | null;
  data: BulkUploadResponse;
  onUploadAnother: () => void;
}) {
  return (
    <Card
      title="Import complete"
      description={fileName ?? undefined}
      action={
        <Button variant="ghost" size="sm" onClick={onUploadAnother}>
          Upload another file
        </Button>
      }
      padding="none"
    >
      <div className="px-6 py-4 flex items-center gap-6 border-b border-slate-200 text-sm">
        <Stat
          color="emerald"
          icon={<CheckCircle2 className="w-4 h-4" />}
          value={data.imported}
          label="imported"
        />
        <Stat color="rose" icon={<X className="w-4 h-4" />} value={data.skipped.length} label="skipped" />
      </div>

      {data.skipped.length > 0 ? (
        <SkippedTable skipped={data.skipped} />
      ) : (
        <div className="px-6 py-6 text-sm text-slate-500 italic text-center">
          All rows imported successfully.
        </div>
      )}
    </Card>
  );
}

// ─── Contacts directory (browse + search + delete) ─────────

function ContactsDirectory({ reloadKey }: { reloadKey: number }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [rows, setRows] = useState<Contact[] | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const requestId = useRef(0);
  const [sentinelRef, sentinelInView] = useIntersection();

  function handleSaved(saved: Contact) {
    setModalOpen(false);
    setRows((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = prev.slice();
      next[idx] = saved;
      return next;
    });
  }

  const load = useCallback(async () => {
    const reqId = ++requestId.current;
    setLoading(true);
    setError(null);
    setRows(null);
    setNextUrl(null);
    setTotal(null);
    try {
      const res = await api.contacts.list({ search: debouncedQuery.trim() || undefined });
      if (requestId.current !== reqId) return;
      setRows(res.results);
      setNextUrl(res.next);
      // Cursor pagination doesn't expose total — show "+ more" when next exists.
      setTotal(res.next ? null : res.results.length);
    } catch (e) {
      if (requestId.current !== reqId) return;
      if (axios.isAxiosError(e) && !e.response) setError("Can't reach the server.");
      else setError("Couldn't load contacts.");
    } finally {
      if (requestId.current === reqId) setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!nextUrl || loadingMore) return;
    const reqId = requestId.current;
    setLoadingMore(true);
    try {
      const res = await api.contacts.listNext(nextUrl);
      if (requestId.current !== reqId) return;
      setRows((prev) => (prev ? [...prev, ...res.results] : res.results));
      setNextUrl(res.next);
      if (!res.next && rows) setTotal(rows.length + res.results.length);
    } catch {
      // Soft fail — leave the sentinel in place; user can scroll again.
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore, rows]);

  useEffect(() => {
    if (sentinelInView) loadMore();
  }, [sentinelInView, loadMore]);

  async function handleDelete(c: Contact) {
    if (
      !window.confirm(
        `Delete contact "${c.full_name || c.phone}"?\n\nThis only removes the contact from the database — any leads created from it stay (their contact info was copied at creation time).`,
      )
    ) {
      return;
    }
    setBusyId(c.id);
    try {
      await api.contacts.remove(c.id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== c.id) : prev));
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.status === 403
          ? "Admin only."
          : "Couldn't delete.";
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Contacts directory"
      description={
        total !== null
          ? `${total} contact${total === 1 ? "" : "s"}`
          : rows
            ? `${rows.length}+ contacts`
            : undefined
      }
      action={
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Add contact
        </Button>
      }
      padding="none"
    >
      <div className="px-6 py-4 border-b border-slate-200">
        <Input
          name="contact-directory-search"
          placeholder="Search by name, phone, email, or company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {error ? (
        <div className="px-6 py-6 text-sm text-rose-700 bg-rose-50">{error}</div>
      ) : loading ? (
        <div className="px-6 py-12 flex justify-center">
          <Spinner size="md" label="Loading contacts…" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-slate-500 italic text-center">
          {debouncedQuery.trim()
            ? "No contacts match your search."
            : "No contacts yet — upload an Excel above to get started."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Email</th>
                  <th className="text-left font-semibold px-4 py-2.5">Name</th>
                  <th className="text-left font-semibold px-4 py-2.5 w-44">Phone</th>
                  <th className="text-left font-semibold px-4 py-2.5">Company</th>
                  <th className="text-left font-semibold px-4 py-2.5">Designation</th>
                  <th className="text-left font-semibold px-4 py-2.5 w-24">Source</th>
                  <th className="w-16 px-4 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700 truncate max-w-xs">
                      {c.email || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-900">
                      {c.full_name || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                      {c.phone || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {c.company || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {c.designation || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{c.source}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"
                          aria-label="Edit contact"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete contact"
                          title="Delete"
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
          <div ref={sentinelRef} className="py-3 text-center text-xs text-slate-500">
            {loadingMore ? (
              <Spinner size="sm" label="Loading more…" />
            ) : nextUrl ? (
              "Scroll to load more"
            ) : (
              `All caught up — ${rows.length} contact${rows.length === 1 ? "" : "s"}`
            )}
          </div>
        </>
      )}

      <ContactFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </Card>
  );
}

// ─── Bits ───────────────────────────────────────────────────

function Stat({
  color,
  icon,
  value,
  label,
}: {
  color: "emerald" | "rose";
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  const bg = color === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full ${bg}`}>
        {icon}
      </span>
      <span className="font-semibold text-ink-900">{value}</span>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function SkippedTable({
  skipped,
  title,
}: {
  skipped: BulkUploadResponse["skipped"];
  title?: string;
}) {
  return (
    <div className="border-t border-slate-200">
      {title && (
        <div className="px-6 py-2.5 text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
          {title}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left font-semibold px-4 py-2.5 w-20">Row</th>
            <th className="text-left font-semibold px-4 py-2.5">Email</th>
            <th className="text-left font-semibold px-4 py-2.5">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {skipped.map((row, idx) => (
            <tr key={`${row.row}-${idx}`} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.row}</td>
              <td className="px-4 py-2.5 text-xs text-slate-700">
                {row.email ?? <span className="text-slate-400 italic">—</span>}
              </td>
              <td className="px-4 py-2.5 text-slate-700">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
