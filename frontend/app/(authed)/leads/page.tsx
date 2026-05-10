"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { Plus } from "lucide-react";

import { Button, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useIntersection } from "@/lib/hooks/useIntersection";
import {
  api,
  type Event as ApiEvent,
  type LeadListItem,
  type LeadListParams,
  type SubPipeline,
} from "@/lib/api";
import { eventSlug, sortSubPipelines } from "@/lib/pipelines";

import { BoardView } from "./components/BoardView";
import { EMPTY_FILTERS, FiltersBar, type FiltersValue } from "./components/FiltersBar";
import { LeadsTable } from "./components/LeadsTable";
import { ViewToggle, type HomeView } from "./components/ViewToggle";

/**
 * Master home page — single hub for both Board (kanban) and List (flat
 * filterable table) views. Phase 2.6 collapses what used to be at
 * `/pipelines/[event]/[sub-pipeline]` onto this page so the client gets
 * the kanban without a drill-down.
 *
 * State carried in URL search params:
 *   ?view=board|list
 *   ?event=<slug>      (board only)
 *   ?pipeline=<slug>   (board only)
 *
 * URL-state means browser-back from a lead detail page restores the
 * exact tabs the user was on — without us touching localStorage.
 *
 * `useSearchParams` requires a Suspense boundary in Next 16 to keep the
 * static shell prerenderable; the auth guard already gates this whole
 * subtree client-side, but the boundary is cheap insurance.
 */
export default function LeadsPage() {
  return (
    <Suspense fallback={<PageBootSpinner />}>
      <LeadsPageInner />
    </Suspense>
  );
}

function PageBootSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spinner size="lg" label="Loading…" />
    </div>
  );
}

function LeadsPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [allSubPipelines, setAllSubPipelines] = useState<SubPipeline[] | null>(null);

  // Fetch events + sub-pipelines once on mount. Both lists are tiny
  // (3 events × 5 pipelines on seeded data) and shared between BoardView
  // tab rendering, the URL-default-resolver below, and the FiltersBar.
  useEffect(() => {
    api.events
      .list(true)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
    api.subPipelines
      .list({ is_active: true })
      .then(setAllSubPipelines)
      .catch(() => setAllSubPipelines([]));
  }, []);

  // ── URL state ─────────────────────────────────────────────────────────
  const rawView = searchParams.get("view");
  const view: HomeView = rawView === "list" ? "list" : "board"; // default = board

  const rawEventSlug = searchParams.get("event") ?? "";
  const rawPipelineSlug = searchParams.get("pipeline") ?? "";

  // Resolve the event slug — URL has priority; otherwise first loaded event.
  const resolvedEventSlug = rawEventSlug || (events[0] ? eventSlug(events[0]) : "");

  // Resolve the default sub-pipeline slug for the resolved event. Phase 2.9
  // dropped the static "delegate-passes" fallback — we instead pick the
  // first sub-pipeline (sorted by sort_order, then name) that belongs to
  // the resolved event. Empty until both events + sub-pipelines have loaded.
  const defaultPipelineSlugForEvent = useMemo(() => {
    if (!allSubPipelines) return "";
    const event = events.find((e) => String(e.id) === resolvedEventSlug);
    if (!event) return "";
    const scoped = sortSubPipelines(allSubPipelines.filter((sp) => sp.event === event.id));
    return scoped[0]?.slug ?? "";
  }, [allSubPipelines, events, resolvedEventSlug]);

  const resolvedPipelineSlug = rawPipelineSlug || defaultPipelineSlugForEvent;

  // After events + pipelines load, normalize the URL to include defaults
  // so the URL is always a faithful pointer at what's on screen and
  // `back` from a lead page lands on the same view + tabs.
  useEffect(() => {
    if (eventsLoading || allSubPipelines == null) return;
    const needs: Record<string, string> = {};
    if (!searchParams.get("view")) needs.view = "board";
    if (view === "board" && !searchParams.get("event") && events[0]) {
      needs.event = eventSlug(events[0]);
    }
    if (view === "board" && !searchParams.get("pipeline") && defaultPipelineSlugForEvent) {
      needs.pipeline = defaultPipelineSlugForEvent;
    }
    if (Object.keys(needs).length === 0) return;
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(needs)) params.set(k, v);
    router.replace(`/leads?${params.toString()}`, { scroll: false });
  }, [
    eventsLoading,
    events,
    view,
    searchParams,
    router,
    allSubPipelines,
    defaultPipelineSlugForEvent,
  ]);

  function setView(next: HomeView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    if (next === "board") {
      // Make sure event + pipeline are present when switching back to board.
      if (!params.get("event") && events[0]) {
        params.set("event", eventSlug(events[0]));
      }
      if (!params.get("pipeline") && defaultPipelineSlugForEvent) {
        params.set("pipeline", defaultPipelineSlugForEvent);
      }
    }
    router.replace(`/leads?${params.toString()}`, { scroll: false });
  }

  function setBoardScope(next: { eventSlug?: string; pipelineSlug?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.eventSlug) {
      params.set("event", next.eventSlug);
      // When the event changes, the current pipeline slug may not exist on
      // the new event. Strip it — BoardView will fall back to the first
      // pipeline of the new event, and the normalize effect above will
      // write the correct slug back into the URL.
      params.delete("pipeline");
    }
    if (next.pipelineSlug) params.set("pipeline", next.pipelineSlug);
    router.replace(`/leads?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl text-ink-900">Master Pipeline</h1>
          <p className="text-sm text-slate-600">
            Switch between <strong>Board</strong> (kanban for one event ×
            one sub-pipeline) and <strong>List</strong> (every lead, fully
            filterable).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle value={view} onChange={setView} />
          <Link href="/leads/new">
            <Button leftIcon={<Plus className="w-4 h-4" />}>New lead</Button>
          </Link>
        </div>
      </div>

      {view === "board" ? (
        eventsLoading || events.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
            <Spinner size="lg" label="Loading events…" />
          </div>
        ) : (
          <BoardView
            events={events}
            eventSlug={resolvedEventSlug}
            pipelineSlug={resolvedPipelineSlug}
            onScopeChange={setBoardScope}
          />
        )
      ) : (
        <ListView events={events} eventsLoading={eventsLoading} user={user} />
      )}
    </div>
  );
}

/* ------------------------------ ListView ------------------------------ */
/**
 * Today's `/leads` page, factored out so it only mounts when the user
 * actually picks List view — avoids running its own `/api/leads/` fetch
 * while Board is showing.
 *
 * Behavior is intentionally unchanged from Phase 2.5: same FiltersBar
 * (search, status pills, event/sub-pipeline/tier dropdowns, source,
 * dates, assignee toggle) + cursor-paginated infinite-scroll table.
 */
function ListView({
  events,
  eventsLoading,
  user,
}: {
  events: ApiEvent[];
  eventsLoading: boolean;
  user: ReturnType<typeof useAuth>["user"];
}) {
  const [filters, setFilters] = useState<FiltersValue>(EMPTY_FILTERS);
  const [rows, setRows] = useState<LeadListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const apiParams: LeadListParams = useMemo(() => {
    const params: LeadListParams = {};
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (filters.statuses.length > 0) params.status = filters.statuses;
    if (filters.eventId) params.event_interest = Number(filters.eventId);
    if (filters.subPipelineId) params.sub_pipeline = Number(filters.subPipelineId);
    if (filters.packageTierId) params.package_tier = Number(filters.packageTierId);
    if (filters.source) params.source = filters.source;
    if (filters.assignedTo === "ME" && user) params.assigned_to = user.id;
    if (filters.createdAfter) params.created_after = filters.createdAfter;
    if (filters.createdBefore) {
      params.created_before = `${filters.createdBefore}T23:59:59`;
    }
    return params;
  }, [debouncedSearch, filters, user]);

  useEffect(() => {
    requestId.current++;
    const myId = requestId.current;
    setLoading(true);
    setError(null);
    setRows([]);
    setNextCursor(null);
    api.leads
      .list(apiParams)
      .then((res) => {
        if (myId !== requestId.current) return;
        setRows(res.results);
        setNextCursor(res.next);
      })
      .catch((e: unknown) => {
        if (myId !== requestId.current) return;
        if (axios.isAxiosError(e) && !e.response) {
          setError("Can't reach the server. Is the backend running?");
        } else if (axios.isAxiosError(e) && e.response) {
          setError(`Server returned ${e.response.status}: ${e.response.statusText}`);
        } else {
          setError("Unexpected error fetching leads.");
        }
      })
      .finally(() => {
        if (myId === requestId.current) setLoading(false);
      });
  }, [apiParams]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore) return;
    const myId = requestId.current;
    setLoadingMore(true);
    try {
      const res = await api.leads.listNext(nextCursor);
      if (myId !== requestId.current) return;
      setRows((prev) => [...prev, ...res.results]);
      setNextCursor(res.next);
    } catch (e: unknown) {
      if (myId !== requestId.current) return;
      if (axios.isAxiosError(e) && !e.response) {
        setError("Lost connection while loading more.");
      } else {
        setError("Couldn't load the next page.");
      }
    } finally {
      if (myId === requestId.current) setLoadingMore(false);
    }
  }, [nextCursor, loading, loadingMore]);

  const [sentinelRef, sentinelInView] = useIntersection({ rootMargin: "200px" });

  useEffect(() => {
    if (sentinelInView) void loadMore();
  }, [sentinelInView, loadMore]);

  return (
    <>
      <FiltersBar
        value={filters}
        onChange={setFilters}
        events={events}
        eventsLoading={eventsLoading}
      />
      <LeadsTable
        rows={rows}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        hasMore={Boolean(nextCursor)}
        sentinelRef={sentinelRef}
      />
    </>
  );
}
