/**
 * Single entry point for the typed API client.
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const { user } = await api.auth.login("admin", "ChangeMe123!");
 *   const page1 = await api.leads.list({ status: ["NEW"] });
 *   const next  = page1.next ? await api.leads.listNext(page1.next) : null;
 */
import { auth } from "./auth";
import { contacts } from "./contacts";
import { dashboards } from "./dashboards";
import { emails } from "./emails";
import { events } from "./events";
import { leads } from "./leads";
import { subPipelines } from "./subpipelines";
import { tiers } from "./tiers";
import { users } from "./users";

export const api = {
  auth,
  contacts,
  dashboards,
  emails,
  events,
  leads,
  subPipelines,
  tiers,
  users,
};

export { tokens, cachedUser } from "./storage";
export { API_BASE_URL, client } from "./client";
export * from "./types";
