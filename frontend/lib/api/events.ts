import { client } from "./client";
import type { Event, EventWithPipelines, EventWritePayload } from "./types";

/**
 * /api/events/ — list/retrieve open to any auth (LeadForm dropdown +
 * master filters); write actions are admin-only and will 403 for callers.
 *
 * `?with_pipelines=true` (used by `listWithPipelines()`) inlines each
 * event's sub-pipelines and their tiers in a single request — the
 * /admin/pipelines page uses this to render the whole hierarchy.
 */
export const events = {
  /** Read-only. `activeOnly` defaults to false on the backend. */
  async list(activeOnly = false) {
    const { data } = await client.get<Event[]>("/api/events/", {
      params: activeOnly ? { active_only: "true" } : undefined,
    });
    return data;
  },

  async listWithPipelines(activeOnly = false) {
    const { data } = await client.get<EventWithPipelines[]>("/api/events/", {
      params: {
        with_pipelines: "true",
        ...(activeOnly ? { active_only: "true" } : {}),
      },
    });
    return data;
  },

  async get(id: number) {
    const { data } = await client.get<Event>(`/api/events/${id}/`);
    return data;
  },

  async create(payload: EventWritePayload) {
    const { data } = await client.post<Event>("/api/events/", payload);
    return data;
  },

  async update(id: number, payload: EventWritePayload) {
    const { data } = await client.patch<Event>(`/api/events/${id}/`, payload);
    return data;
  },

  async remove(id: number) {
    await client.delete(`/api/events/${id}/`);
  },
};
