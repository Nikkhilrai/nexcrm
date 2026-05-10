import { client } from "./client";
import type {
  CreateInteractionPayload,
  Interaction,
  LeadDetail,
  LeadListItem,
  LeadListParams,
  LeadWritePayload,
  PaginatedResponse,
  StatusHistory,
} from "./types";

export const leads = {
  /** First page. Use `listNext(cursorUrl)` to fetch subsequent pages. */
  async list(params?: LeadListParams) {
    const { data } = await client.get<PaginatedResponse<LeadListItem>>(
      "/api/leads/",
      { params },
    );
    return data;
  },

  /** Cursor pagination: backend returns absolute URLs in `next`/`previous`. */
  async listNext(cursorUrl: string) {
    const { data } = await client.get<PaginatedResponse<LeadListItem>>(cursorUrl);
    return data;
  },

  async get(id: string) {
    const { data } = await client.get<LeadDetail>(`/api/leads/${id}/`);
    return data;
  },

  async create(payload: LeadWritePayload) {
    const { data } = await client.post<LeadDetail>("/api/leads/", payload);
    return data;
  },

  /** PATCH — partial update. Backend requires `status_change_comment`
   *  whenever `status` is being changed; LeadWritePayload exposes it. */
  async update(id: string, payload: LeadWritePayload) {
    const { data } = await client.patch<LeadDetail>(`/api/leads/${id}/`, payload);
    return data;
  },

  /** Admin-only on the backend. Non-admin callers will see 403. */
  async remove(id: string) {
    await client.delete(`/api/leads/${id}/`);
  },

  /** Powers the edit-page sidebar — past leads from the same number. */
  async byPhone(phone: string, exclude?: string) {
    const { data } = await client.get<LeadListItem[]>("/api/leads/by-phone/", {
      params: { phone, exclude },
    });
    return data;
  },

  interactions: {
    async list(leadId: string) {
      const { data } = await client.get<Interaction[]>(
        `/api/leads/${leadId}/interactions/`,
      );
      return data;
    },
    async create(leadId: string, payload: CreateInteractionPayload) {
      const { data } = await client.post<Interaction>(
        `/api/leads/${leadId}/interactions/`,
        payload,
      );
      return data;
    },
  },

  async statusHistory(id: string) {
    const { data } = await client.get<StatusHistory[]>(
      `/api/leads/${id}/status-history/`,
    );
    return data;
  },
};
