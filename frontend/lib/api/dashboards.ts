import { client } from "./client";
import type { DashboardPayload, UserActivityRow } from "./types";

/** All endpoints here are admin-only on the backend. */
export const dashboards = {
  async overview(month?: string) {
    const params = month ? { month } : {};
    const { data } = await client.get<DashboardPayload>("/api/admin/dashboard/", { params });
    return data;
  },

  async userActivity(month?: string) {
    const params = month ? { month } : {};
    const { data } = await client.get<UserActivityRow[]>(
      "/api/admin/user-activity/",
      { params },
    );
    return data;
  },
};
