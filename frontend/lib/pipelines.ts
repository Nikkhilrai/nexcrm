/**
 * URL-slug ↔ DB id helpers. Phase 2.6 collapsed the kanban onto the home
 * page (`/leads?view=board&event=<id>&pipeline=<slug>`) — these helpers
 * power that URL state.
 *
 * Phase 2.9 made sub-pipelines admin-managed and per-event. The static
 * `PRODUCT_SLUG_TO_ENUM` / `ENUM_TO_PRODUCT_SLUG` / `PRODUCT_ORDER` maps
 * are gone; consumers now look up sub-pipelines by their persisted slug
 * (which the backend auto-derives from the name and dedupes within the
 * event) against the rows fetched from `/api/sub-pipelines/?event=<id>`.
 *
 * Phase 2.9.13 (post-cutover fix): switched event URL keys from a
 * city-derived slug to the numeric `event.id`. The city-slug version
 * silently aliased two same-city events together (e.g. "Dubai" + a new
 * "Dubai 2027") so only the first was reachable from the URL. IDs are
 * guaranteed unique. Old `?event=dubai` bookmarks no longer resolve —
 * acceptable for an internal tool.
 */
import type { Event as ApiEvent, SubPipeline } from "@/lib/api";

/** URL value for an event — numeric id stringified. Stable + unique. */
export function eventSlug(event: ApiEvent): string {
  return String(event.id);
}

/** Look up an event by its URL slug (numeric id as string). */
export function findEventBySlug(events: ApiEvent[], slug: string): ApiEvent | null {
  const id = Number(slug);
  if (!Number.isFinite(id)) return null;
  return events.find((e) => e.id === id) ?? null;
}

/** Look up a sub-pipeline by its persisted slug within a list scoped to one
 *  event. Falls back to a sort-order-first comparison when no match is found. */
export function findSubPipelineBySlug(
  subPipelines: SubPipeline[],
  slug: string,
): SubPipeline | null {
  const target = slug.toLowerCase();
  return subPipelines.find((sp) => sp.slug.toLowerCase() === target) ?? null;
}

/** Sort sub-pipelines by sort_order then name — matches backend ordering and
 *  keeps the BoardView tabs / LeadForm dropdown stable across renders. */
export function sortSubPipelines<T extends { sort_order: number; name: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  );
}
