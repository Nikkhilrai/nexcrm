import { client } from "./client";
import type { PackageTier, TierListParams, TierWritePayload } from "./types";

/**
 * /api/tiers/ — list/retrieve open to any auth (LeadForm dropdown);
 * write actions are admin-only and will 403 for callers.
 *
 * Backend disables pagination on this endpoint, so `list()` returns the
 * full array directly — not a paginated envelope.
 */
export const tiers = {
  async list(params?: TierListParams) {
    const { data } = await client.get<PackageTier[]>("/api/tiers/", { params });
    return data;
  },

  async get(id: number) {
    const { data } = await client.get<PackageTier>(`/api/tiers/${id}/`);
    return data;
  },

  async create(payload: TierWritePayload) {
    const { data } = await client.post<PackageTier>("/api/tiers/", payload);
    return data;
  },

  async update(id: number, payload: TierWritePayload) {
    const { data } = await client.patch<PackageTier>(`/api/tiers/${id}/`, payload);
    return data;
  },

  async remove(id: number) {
    await client.delete(`/api/tiers/${id}/`);
  },
};
