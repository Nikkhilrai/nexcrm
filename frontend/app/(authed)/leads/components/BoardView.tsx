"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import { Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  api,
  type Event as ApiEvent,
  type LeadListItem,
  type SubPipeline,
} from "@/lib/api";
import {
  eventSlug,
  findSubPipelineBySlug,
  sortSubPipelines,
} from "@/lib/pipelines";

import { KanbanBoard } from "./KanbanBoard";

export interface BoardViewProps {
  events: ApiEvent[];
  /** Currently selected event slug (URL-controlled). */
  eventSlug: string;
  /** Currently selected sub-pipeline slug (URL-controlled). Backend-persisted. */
  pipelineSlug: string;
  /** Fired when the user clicks a different event/sub-pipeline tab. Parent
   *  is expected to push the new params into the URL via router.replace. */
  onScopeChange: (next: { eventSlug?: string; pipelineSlug?: string }) => void;
}

/**
 * Two tab rows (events, then sub-pipelines) above a 9-column kanban scoped
 * to the chosen event × sub-pipeline. The sub-pipeline tab list is now
 * driven by `/api/sub-pipelines/?event=<id>` (Phase 2.9 — admin-managed
 * per-event hierarchy) instead of the static `PRODUCT_ORDER` map.
 */
export function BoardView({
  events,
  eventSlug: evSlug,
  pipelineSlug,
  onScopeChange,
}: BoardViewProps) {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allSubPipelines, setAllSubPipelines] = useState<SubPipeline[] | null>(null);

  // One-shot fetch of every active sub-pipeline; we filter client-side per
  // event below. Tiny list (~15 rows on seeded data) so this is cheaper
  // than re-fetching every time the event tab changes.
  useEffect(() => {
    let cancelled = false;
    api.subPipelines
      .list({ is_active: true })
      .then((rows) => !cancelled && setAllSubPipelines(rows))
      .catch(() => !cancelled && setAllSubPipelines([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve URL slugs to actual entities. If a slug doesn't match (e.g.
  // someone hand-typed `/leads?event=999`) we fall back to the first
  // valid option silently — better UX than a 404 inside the home page.
  const event = useMemo(
    () => events.find((e) => String(e.id) === evSlug) ?? events[0] ?? null,
    [events, evSlug],
  );

  const eventPipelines = useMemo(() => {
    if (!event || !allSubPipelines) return [];
    return sortSubPipelines(allSubPipelines.filter((sp) => sp.event === event.id));
  }, [allSubPipelines, event]);

  const subPipeline = useMemo(() => {
    if (eventPipelines.length === 0) return null;
    return findSubPipelineBySlug(eventPipelines, pipelineSlug) ?? eventPipelines[0];
  }, [eventPipelines, pipelineSlug]);

  useEffect(() => {
    if (!event || !subPipeline) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLeads([]);

    fetchAllLeads(event.id, subPipeline.id, () => cancelled)
      .then((all) => {
        if (cancelled) return;
        setLeads(all);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (axios.isAxiosError(e) && !e.response) {
          setError("Can't reach the server. Is the backend running?");
        } else {
          setError("Couldn't load this pipeline.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event, subPipeline]);

  return (
    <div className="space-y-4">
      {/* Row 1 — events */}
      <TabRow ariaLabel="Event">
        {events.map((ev) => {
          const slug = eventSlug(ev);
          return (
            <Tab
              key={ev.id}
              active={ev.id === event?.id}
              onClick={() => onScopeChange({ eventSlug: slug })}
              title={ev.name}
            >
              {ev.name}
            </Tab>
          );
        })}
      </TabRow>

      {/* Row 2 — sub-pipelines (per current event) */}
      <TabRow ariaLabel="Sub-pipeline">
        {allSubPipelines == null ? (
          <span className="px-3 py-1.5 text-xs text-slate-500 italic">
            Loading sub-pipelines…
          </span>
        ) : eventPipelines.length === 0 ? (
          <span className="px-3 py-1.5 text-xs text-slate-500 italic">
            No sub-pipelines yet for this event — admin can add them in /admin/pipelines.
          </span>
        ) : (
          eventPipelines.map((sp) => (
            <Tab
              key={sp.id}
              active={subPipeline?.id === sp.id}
              onClick={() => onScopeChange({ pipelineSlug: sp.slug })}
              title={sp.name}
            >
              {sp.name}
            </Tab>
          ))
        )}
      </TabRow>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Spinner size="lg" label="Loading pipeline…" />
        </div>
      )}

      {!loading && !error && (
        <KanbanBoard
          leads={leads}
          onMove={async (leadId, newStatus, comment) => {
            const previous = leads;
            // Optimistic move — board renders new column immediately.
            setLeads((rows) =>
              rows.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)),
            );
            try {
              await api.leads.update(leadId, {
                status: newStatus,
                status_change_comment: comment,
              });
            } catch (e) {
              setLeads(previous); // rollback so card snaps back
              throw e;
            }
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------- Tab UI ------------------------------- */

function TabRow({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // flex-wrap lets long sub-pipeline labels (e.g. "VIP / Media Partners
      // & Associations") flow to a second row on narrow viewports rather
      // than truncating.
      className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-1"
    >
      {children}
    </div>
  );
}

function Tab({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------- Cursor walker ---------------------------- */

/**
 * Walk the cursor-paginated /api/leads/ endpoint until exhausted, scoping
 * to a single event + sub-pipeline. Kanban needs the full set so column
 * counts are accurate — there's no "load more" affordance on a board.
 *
 * `isCancelled` is read on each loop tick so an in-flight walk aborts
 * cleanly when the user switches tabs mid-fetch.
 */
async function fetchAllLeads(
  eventId: number,
  subPipelineId: number,
  isCancelled: () => boolean,
): Promise<LeadListItem[]> {
  const first = await api.leads.list({
    event_interest: eventId,
    sub_pipeline: subPipelineId,
  });
  if (isCancelled()) return [];

  const out: LeadListItem[] = [...first.results];
  let next = first.next;
  while (next && !isCancelled()) {
    const page = await api.leads.listNext(next);
    if (isCancelled()) break;
    out.push(...page.results);
    next = page.next;
  }
  return out;
}
