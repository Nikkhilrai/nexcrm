import { client } from "./client";
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from "./types";

/** All endpoints here are admin-only on the backend (IsAdmin permission).
 *  Non-admin callers will receive 403. The frontend route guard in Step 5
 *  prevents non-admin users from reaching pages that import these. */
export const users = {
  async list() {
    const { data } = await client.get<AdminUser[]>("/api/users/");
    return data;
  },

  async get(id: number) {
    const { data } = await client.get<AdminUser>(`/api/users/${id}/`);
    return data;
  },

  async create(payload: CreateUserPayload) {
    const { data } = await client.post<AdminUser>("/api/users/", payload);
    return data;
  },

  async update(id: number, payload: UpdateUserPayload) {
    const { data } = await client.patch<AdminUser>(`/api/users/${id}/`, payload);
    return data;
  },

  /** Convenience wrapper — to "delete" a user, set is_active=false.
   *  The backend blocks DELETE on /api/users/ to preserve audit trails. */
  async deactivate(id: number) {
    return this.update(id, { is_active: false });
  },
};
