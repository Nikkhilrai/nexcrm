"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ArrowLeft, Trash2, CalendarDays } from "lucide-react";

import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import {
  api,
  type AdminUser,
  type Event as ApiEvent,
  type LeadDetail,
} from "@/lib/api";

import { LeadForm } from "../components/LeadForm";
import { SamePhonePanel } from "../components/SamePhonePanel";
import { InteractionsPanel } from "../components/InteractionsPanel";
import { StatusTimelinePanel } from "../components/StatusTimelinePanel";
import { EmailsPanel } from "../components/EmailsPanel";

export default function LeadEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  /** "Back to leads" — pop browser history so we land on the exact tab
   *  the user came from (e.g. ?view=board&event=mumbai&pipeline=speakers).
   *  Using a plain <Link href="/leads"> instead would PUSH a fresh entry
   *  with no params, and the home page would re-default to the first
   *  event/sub-pipeline. Falls back to /leads when there's no history
   *  (direct URL load, new tab). */
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/leads");
    }
  }

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Bumped after every save so the status timeline re-fetches.
  const [timelineKey, setTimelineKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const isAdmin = user?.role === "ADMIN";
    Promise.all([
      api.leads.get(id),
      api.events.list(true),
      isAdmin ? api.users.list() : Promise.resolve(null),
    ])
      .then(([l, ev, us]) => {
        if (cancelled) return;
        setLead(l);
        setEvents(ev);
        setUsers(us);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setBootError("Lead not found.");
        } else if (axios.isAxiosError(e) && !e.response) {
          setBootError("Can't reach the server. Is the backend running?");
        } else {
          setBootError("Couldn't load this lead.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  async function handleDelete() {
    if (!lead) return;
    const confirmed = window.confirm(
      `Delete "${lead.full_name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.leads.remove(id);
      router.push("/leads");
    } catch {
      alert("Failed to delete lead. Try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to leads
          </button>
          <h1 className="text-3xl text-ink-900 mt-2">
            {lead ? lead.full_name : "Lead"}
          </h1>
          {lead && (
            <p className="text-sm text-slate-600">
              {lead.company || "—"} · {lead.phone}
            </p>
          )}
          {lead && (
            <p className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-sm">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              Created on{" "}
              <span className="font-semibold text-slate-800">
                {new Date(lead.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
        </div>

        {user?.role === "ADMIN" && lead && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="mt-7 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting…" : "Delete lead"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading lead…" />
        </div>
      ) : bootError ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {bootError}
        </div>
      ) : lead ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {savedFlash && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">
                Saved.
              </div>
            )}
            <LeadForm
              mode="edit"
              initial={lead}
              events={events}
              users={users}
              currentUser={user}
              onSubmit={(payload) => api.leads.update(id, payload)}
              onSaved={(updated) => {
                setLead(updated);
                setSavedFlash(true);
                setTimelineKey((k) => k + 1);
                window.setTimeout(() => setSavedFlash(false), 2500);
              }}
            />
          </div>

          <aside className="space-y-5">
            <SamePhonePanel phone={lead.phone} email={lead.email ?? undefined} excludeId={lead.id} />
            <InteractionsPanel leadId={lead.id} />
            <StatusTimelinePanel leadId={lead.id} refreshKey={timelineKey} />
            <EmailsPanel leadId={lead.id} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
