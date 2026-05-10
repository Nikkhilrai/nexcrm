"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import {
  Send, XCircle, CheckCircle2, Clock, AlertCircle, Plus,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";

import { Badge, Button, Card, Modal, Spinner } from "@/components/ui";
import {
  api,
  type EmailStatus,
  type EmailTemplate,
  type EmailThreadItem,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmailStatus,
  { label: string; tone: "amber" | "emerald" | "rose" | "neutral"; Icon: React.ElementType }
> = {
  PENDING:   { label: "Pending",   tone: "amber",   Icon: Clock },
  SENT:      { label: "Sent",      tone: "emerald",  Icon: CheckCircle2 },
  FAILED:    { label: "Failed",    tone: "rose",     Icon: AlertCircle },
  CANCELLED: { label: "Cancelled", tone: "neutral",  Icon: XCircle },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function delayLabel(hours: number): string {
  if (hours === 0) return "immediately";
  if (hours === 1) return "after 1 hour";
  if (hours < 24) return `after ${hours} hours`;
  const d = Math.floor(hours / 24), r = hours % 24;
  return r === 0 ? `after ${d}d` : `after ${d}d ${r}h`;
}

// ─── Send Email Modal ─────────────────────────────────────────────────────────

interface SendModalProps {
  open: boolean;
  leadId: string;
  onClose: () => void;
  onSent: () => void;
}

function SendEmailModal({ open, leadId, onClose, onSent }: SendModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [delayHours, setDelayHours] = useState("0");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setTemplateId(""); setDelayHours("0"); setError(null); return; }
    setLoadingTemplates(true);
    api.emails.listTemplates({ active_only: true })
      .then((t) => { setTemplates(t); setTemplateId(t[0] ? String(t[0].id) : ""); })
      .catch(() => setError("Couldn't load templates."))
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  const hours = Number(delayHours);
  const hoursValid = Number.isInteger(hours) && hours >= 0 && hours <= 168;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!templateId) { setError("Please select a template."); return; }
    if (!hoursValid) { setError("Delay must be 0–168 hours."); return; }
    setSending(true);
    setError(null);
    try {
      await api.emails.sendToLead(leadId, {
        template_id: Number(templateId),
        delay_hours: hours,
      });
      onSent();
    } catch (e) {
      const msg = axios.isAxiosError(e) && e.response?.data
        ? (() => {
            const d = e.response!.data as Record<string, unknown>;
            if (typeof d.detail === "string") return d.detail;
            const [k, v] = Object.entries(d)[0] ?? [];
            return k ? `${k}: ${Array.isArray(v) ? v.join(" ") : v}` : "Couldn't send.";
          })()
        : "Couldn't send.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !sending && onClose()}
      title="Send email"
      description="Queue an email to this lead. It will be delivered by the background mailer."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button
            form="send-email-form"
            type="submit"
            loading={sending}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            {hours === 0 ? "Send now" : `Schedule (${delayLabel(hours)})`}
          </Button>
        </>
      }
    >
      <form id="send-email-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Template *
          </label>
          {loadingTemplates ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <Spinner size="sm" /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              No active templates.{" "}
              <a href="/admin/email-templates" className="text-brand-600 hover:underline">
                Create one first.
              </a>
            </div>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Send after (hours)
          </label>
          <input
            type="number"
            min={0}
            max={168}
            step={1}
            value={delayHours}
            onChange={(e) => setDelayHours(e.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            {hoursValid
              ? hours === 0
                ? "Will be picked up within ~60 seconds."
                : `Will be delivered ${delayLabel(hours)} from now.`
              : "Enter a value between 0 and 168."}
          </p>
        </div>
      </form>
    </Modal>
  );
}

// ─── Thread Item ──────────────────────────────────────────────────────────────

interface ThreadItemProps {
  item: EmailThreadItem;
  leadId: string;
  onCancelled: (id: string) => void;
}

function ThreadItem({ item, leadId, onCancelled }: ThreadItemProps) {
  const [cancelling, setCancelling] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isInbound = item.direction === "inbound";

  async function cancel() {
    setCancelling(true);
    try {
      await api.emails.cancelEmail(leadId, item.id);
      onCancelled(item.id);
    } catch {
      window.alert("Couldn't cancel email.");
    } finally {
      setCancelling(false);
    }
  }

  if (isInbound) {
    return (
      <li className="flex gap-3">
        <span className="shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mt-0.5 border border-emerald-200">
          <ArrowDownLeft className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge tone="emerald">Reply</Badge>
            <span className="text-[11px] text-slate-400">{formatWhen(item.timestamp)}</span>
          </div>
          <p className="text-sm font-medium text-ink-900 truncate">{item.subject || "(no subject)"}</p>
          <p className="text-xs text-slate-500 truncate">{item.from_email}</p>
          {item.body && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] text-brand-600 hover:underline"
              >
                {expanded ? "Hide" : "Show reply"}
              </button>
              {expanded && (
                <div className="mt-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {item.body}
                </div>
              )}
            </div>
          )}
        </div>
      </li>
    );
  }

  // Outbound
  const cfg = item.status ? STATUS_CONFIG[item.status] : STATUS_CONFIG.SENT;
  const Icon = cfg.Icon;
  const isPending = item.status === "PENDING";

  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mt-0.5">
        <ArrowUpRight className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink-900 truncate">
            {item.template_name ?? "Manual email"}
          </span>
          {item.status && <Badge tone={cfg.tone}>{cfg.label}</Badge>}
        </div>

        <p className="text-xs text-slate-500 truncate" title={item.subject}>
          {item.subject}
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-[11px] text-slate-400">
            {formatWhen(item.timestamp)}
            {item.triggered_by_username
              ? ` · ${item.rule_name ? "auto" : item.triggered_by_username}`
              : item.rule_name
              ? " · auto"
              : ""}
          </p>

          {isPending && (
            <button
              onClick={cancel}
              disabled={cancelling}
              className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline disabled:opacity-40 shrink-0"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>

        {item.status === "PENDING" && (
          <p className="text-[10px] text-amber-600">
            <Icon className="w-3 h-3 inline mr-0.5" />
            Scheduled · will send automatically
          </p>
        )}
      </div>
    </li>
  );
}

// ─── Emails Panel ─────────────────────────────────────────────────────────────

interface EmailsPanelProps {
  leadId: string;
}

export function EmailsPanel({ leadId }: EmailsPanelProps) {
  const [thread, setThread] = useState<EmailThreadItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    setThread(null);
    setLoadError(null);
    api.emails.getThread(leadId)
      .then(setThread)
      .catch(() => setLoadError("Couldn't load email thread."));
  }

  useEffect(() => { load(); }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSent() {
    setModalOpen(false);
    load();
  }

  function handleCancelled(id: string) {
    setThread((prev) =>
      prev?.map((item) =>
        item.id === id ? { ...item, status: "CANCELLED" as EmailStatus } : item
      ) ?? prev
    );
  }

  const inboundCount = thread?.filter((i) => i.direction === "inbound").length ?? 0;

  return (
    <>
      <Card
        title="Email Thread"
        description={
          inboundCount > 0
            ? `${inboundCount} repl${inboundCount === 1 ? "y" : "ies"} received`
            : "Sent and received emails for this lead."
        }
        action={
          <Button
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setModalOpen(true)}
          >
            Send
          </Button>
        }
      >
        {loadError ? (
          <p className="text-sm text-rose-700">{loadError}</p>
        ) : thread === null ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" label="Loading…" />
          </div>
        ) : thread.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No emails yet.</p>
        ) : (
          <ul className="space-y-4">
            {thread.map((item) => (
              <ThreadItem
                key={`${item.direction}-${item.id}`}
                item={item}
                leadId={leadId}
                onCancelled={handleCancelled}
              />
            ))}
          </ul>
        )}
      </Card>

      <SendEmailModal
        open={modalOpen}
        leadId={leadId}
        onClose={() => setModalOpen(false)}
        onSent={handleSent}
      />
    </>
  );
}
