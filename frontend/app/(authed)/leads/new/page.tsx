"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { api, type AdminUser, type Event as ApiEvent } from "@/lib/api";

import { LeadForm } from "../components/LeadForm";

export default function NewLeadPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isAdmin = user?.role === "ADMIN";
    Promise.all([
      api.events.list(true),
      isAdmin ? api.users.list() : Promise.resolve(null),
    ])
      .then(([ev, us]) => {
        if (cancelled) return;
        setEvents(ev);
        setUsers(us);
      })
      .catch(() => {
        if (cancelled) return;
        setBootError("Couldn't load events. Is the backend running?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to leads
        </Link>
        <h1 className="text-3xl text-ink-900 mt-2">New lead</h1>
        <p className="text-sm text-slate-600">Add a prospect for a LexTalk event.</p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading form…" />
        </div>
      ) : bootError ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {bootError}
        </div>
      ) : (
        <LeadForm
          mode="create"
          events={events}
          users={users}
          currentUser={user}
          onSubmit={(payload) => api.leads.create(payload)}
          onSaved={(lead) => router.push(`/leads/${lead.id}`)}
        />
      )}
    </div>
  );
}
