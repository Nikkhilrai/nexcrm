import { client } from "./client";
import type {
  SubPipeline,
  SubPipelineListParams,
  SubPipelineWritePayload,
} from "./types";

/**
 * /api/sub-pipelines/ — list/retrieve open to any auth (LeadForm dropdown +
 * master filters cascade); write actions are admin-only.
 *
 * Backend disables pagination on this endpoint, so `list()` returns the
 * full array directly — not a paginated envelope.
 *
 * `slug` is server-derived from `name` and read-only on the wire.
 */
export const subPipelines = {
  async list(params?: SubPipelineListParams) {
    const { data } = await client.get<SubPipeline[]>("/api/sub-pipelines/", {
      params,
    });
    return data;
  },

  async get(id: number) {
    const { data } = await client.get<SubPipeline>(`/api/sub-pipelines/${id}/`);
    return data;
  },

  async create(payload: SubPipelineWritePayload) {
    const { data } = await client.post<SubPipeline>("/api/sub-pipelines/", payload);
    return data;
  },

  async update(id: number, payload: Partial<SubPipelineWritePayload>) {
    const { data } = await client.patch<SubPipeline>(
      `/api/sub-pipelines/${id}/`,
      payload,
    );
    return data;
  },

  async remove(id: number) {
    await client.delete(`/api/sub-pipelines/${id}/`);
  },
};
