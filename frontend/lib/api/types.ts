/**
 * API types — mirror the backend serializers exactly.
 * If a backend field changes, update here too.
 */

// ─── Roles & enums ──────────────────────────────────────────
export type Role = "ADMIN" | "USER";

export type Currency = "INR" | "USD";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};

export type LeadStatus =
  | "LEAD_ASSIGNED"
  | "CALL_CONNECTED"
  | "INFO_SENT"
  | "FOLLOWUP_1"
  | "FOLLOWUP_2"
  | "FOLLOWUP_3"
  | "DEAL_WON"
  | "DEAL_LOST"
  | "DECLINED";

/** Ordered as the kanban columns + funnel chart should render. */
export const LEAD_STATUSES: readonly LeadStatus[] = [
  "LEAD_ASSIGNED",
  "CALL_CONNECTED",
  "INFO_SENT",
  "FOLLOWUP_1",
  "FOLLOWUP_2",
  "FOLLOWUP_3",
  "DEAL_WON",
  "DEAL_LOST",
  "DECLINED",
] as const;

export type LeadSource =
  | "WEBSITE_FORM"
  | "LINKEDIN"
  | "REFERRAL"
  | "COLD_CALL"
  | "EMAIL"
  | "OTHER";

export type InteractionType =
  | "CALL"
  | "EMAIL"
  | "LINKEDIN"
  | "WHATSAPP"
  | "MEETING"
  | "NOTE";

// ─── User ──────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

/** Returned by /api/users/ (admin-only). Adds activity + audit fields. */
export interface AdminUser extends User {
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface CreateUserPayload {
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password: string;
  role: Role;
  is_active?: boolean;
}

export type UpdateUserPayload = Partial<CreateUserPayload>;

// ─── Event ─────────────────────────────────────────────────
export interface Event {
  id: number;
  name: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export type EventWritePayload = Partial<Omit<Event, "id">> & {
  name?: string;
  city?: string;
  country?: string;
  start_date?: string;
  end_date?: string;
};

// ─── SubPipeline (Phase 2.9) ───────────────────────────────
/** Per-event sub-pipeline (Sponsors, Speakers, …). Replaced the old
 *  hardcoded `ProductInterest` enum. Each row belongs to one Event. */
export interface SubPipeline {
  id: number;
  event: number;
  name: string;
  /** URL-safe identifier, server-derived from name. Read-only on the wire. */
  slug: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SubPipelineWritePayload = Partial<
  Omit<SubPipeline, "id" | "slug" | "created_at" | "updated_at">
> & {
  event: number;
  name: string;
};

/** Tier brief nested inside `EventWithPipelines.sub_pipelines[i].tiers`. */
export interface NestedTier {
  id: number;
  name: string;
  default_price_inr: string | null;
  default_price_usd: string | null;
  is_active: boolean;
  sort_order: number;
}

/** SubPipeline brief nested inside `EventWithPipelines.sub_pipelines`. */
export interface NestedSubPipeline {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
  tiers: NestedTier[];
}

/** `?with_pipelines=true` shape — used by the /admin/pipelines page so
 *  the entire Event → SubPipeline → Tier hierarchy comes back in one
 *  request. Backend builds it via prefetch_related. */
export interface EventWithPipelines extends Event {
  sub_pipelines: NestedSubPipeline[];
}

// ─── Package tier ──────────────────────────────────────────
export interface PackageTier {
  id: number;
  /** FK to SubPipeline (Phase 2.9). Replaces the old product_interest enum. */
  sub_pipeline: number;
  name: string;
  /** Decimal serialized as string. Null = no default (in-kind, free, etc.). */
  default_price_inr: string | null;
  default_price_usd: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Subset of PackageTier nested into LeadDetail.package_tier_detail. */
export interface PackageTierBrief {
  id: number;
  sub_pipeline: number;
  name: string;
  default_price_inr: string | null;
  default_price_usd: string | null;
  is_active: boolean;
  sort_order: number;
}

// ─── Lead ──────────────────────────────────────────────────
/** Last status change captured by the StatusHistory signal — surfaced on
 *  kanban cards so callers see the "why" without opening the lead.
 *  Null when the latest history row has an empty comment (e.g. on creation). */
export interface LatestStatusNote {
  comment: string;
  to_status: LeadStatus;
  /** ISO timestamp. */
  changed_at: string;
  changed_by_username: string | null;
}

export interface LeadListItem {
  id: string; // UUID
  full_name: string;
  phone: string;
  company: string;
  designation: string;
  status: LeadStatus;
  source: LeadSource;
  /** Sub-pipeline FK (Phase 2.9 — replaces product_interest). */
  sub_pipeline: number;
  /** Sub-pipeline display name, denormalized for the table. */
  sub_pipeline_name: string | null;
  /** Tier FK id (null if not set). */
  package_tier: number | null;
  /** Tier display name, denormalized for the table. Null if unset. */
  package_tier_name: string | null;
  event: Event | null;
  assigned_to: number | null;
  assigned_to_username: string | null;
  next_followup_at: string | null;
  created_at: string;
  /** Latest StatusHistory row's comment + actor + when. Null if none. */
  latest_status_note: LatestStatusNote | null;
}

export interface LeadDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
  linkedin_url: string;
  city: string;
  country: string;
  event_interest: number;
  event: Event | null;
  /** Sub-pipeline FK (Phase 2.9 — replaces product_interest). */
  sub_pipeline: number;
  package_tier: number | null;
  package_tier_detail: PackageTierBrief | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_to: number | null;
  assigned_to_username: string | null;
  next_followup_at: string | null;
  /** Decimal serialized as string (Django convention). */
  deal_value: string | null;
  deal_currency: Currency;
  notes: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

/** Required when status changes; backend will 400 without it. */
export interface LeadWritePayload
  extends Partial<
    Omit<
      LeadDetail,
      | "id"
      | "event"
      | "package_tier_detail"
      | "assigned_to_username"
      | "created_by"
      | "created_by_username"
      | "created_at"
      | "updated_at"
    >
  > {
  status_change_comment?: string;
}

export interface LeadListParams {
  status?: LeadStatus[];
  event_interest?: number;
  sub_pipeline?: number;
  package_tier?: number;
  source?: LeadSource;
  assigned_to?: number;
  search?: string;
  created_after?: string;
  created_before?: string;
  next_followup_after?: string;
  next_followup_before?: string;
}

// ─── Tier API params ───────────────────────────────────────
export interface TierListParams {
  sub_pipeline?: number;
  is_active?: boolean;
}

// ─── SubPipeline API params ────────────────────────────────
export interface SubPipelineListParams {
  event?: number;
  is_active?: boolean;
}

export type TierWritePayload = Partial<
  Omit<PackageTier, "id" | "created_at" | "updated_at">
>;

// ─── Contact ───────────────────────────────────────────────
export interface Contact {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  company: string;
  designation: string;
  linkedin_url: string;
  source: LeadSource;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactListParams {
  search?: string;
}

export type ContactWritePayload = Partial<
  Omit<Contact, "id" | "created_by" | "created_by_username" | "created_at" | "updated_at">
> & {
  phone: string;
};

/** Per-row error returned by /api/contacts/bulk-upload/. */
export interface BulkUploadSkippedRow {
  /** 1-indexed sheet row (matches what the admin sees in Excel). */
  row: number;
  /** Normalized phone, when extractable. Omitted when phone was missing. */
  phone?: string;
  reason: string;
}

/** Per-row preview of what was (or would be, in dry-run) imported. */
export interface BulkUploadPreviewRow {
  phone: string;
  full_name: string;
  email: string;
  company: string;
  designation: string;
  linkedin_url: string;
  source: LeadSource;
}

export interface BulkUploadResponse {
  /** Rows actually written. 0 in dry-run mode. */
  imported: number;
  /** Rows that would have been written (same as `imported` outside dry-run). */
  would_import: number;
  dry_run: boolean;
  skipped: BulkUploadSkippedRow[];
  preview: BulkUploadPreviewRow[];
}

// ─── Interaction ───────────────────────────────────────────
export interface Interaction {
  id: number;
  lead: string;
  user: number | null;
  user_username: string | null;
  type: InteractionType;
  outcome: string;
  notes: string;
  occurred_at: string;
  created_at: string;
}

export interface CreateInteractionPayload {
  type: InteractionType;
  outcome?: string;
  notes?: string;
  occurred_at: string;
}

// ─── Status history ────────────────────────────────────────
export interface StatusHistory {
  id: number;
  from_status: string;
  to_status: string;
  comment: string;
  changed_by: number | null;
  changed_by_username: string | null;
  changed_at: string;
}

// ─── Pagination ────────────────────────────────────────────
export interface PaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Auth ──────────────────────────────────────────────────
export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RefreshResponse {
  access: string;
  refresh: string;
}

// ─── Admin dashboard ───────────────────────────────────────
export interface DashboardKpis {
  /** "May 2026" — label for the selected calendar month. */
  month_label: string;
  leads_month: number;
  conversions_month: number;
  /** Decimal as string — INR deals only. */
  revenue_month_inr: string;
  /** Decimal as string — USD deals only. */
  revenue_month_usd: string;
  /** Avg days created → WON for this month's won deals. */
  avg_conversion_days: number | null;
}

export interface DashboardRecentLead {
  id: string;
  full_name: string;
  company: string;
  status: LeadStatus;
  sub_pipeline_name: string;
  assigned_to_username: string;
  created_at: string;
}

export interface DashboardPayload {
  kpis: DashboardKpis;
  leads_by_status: { status: LeadStatus; count: number }[];
  leads_by_event: { event_id: number; city: string; count: number }[];
  conversions_by_day: { day: string; count: number }[];
  recent_leads: DashboardRecentLead[];
}

export interface UserActivityRow {
  user_id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  calls_month: number;
  emails_month: number;
  leads_touched_month: number;
  /** Total interactions (all types) logged this month. */
  interactions_month: number;
  /** Live overdue count for the current month; null for past months. */
  followups_due: number | null;
  /** Leads created this month assigned to this user. */
  leads_assigned: number;
  conversions_month: number;
  /** Decimal as string — INR deals only. */
  revenue_month_inr: string;
  /** Decimal as string — USD deals only. */
  revenue_month_usd: string;
}

// ─── Email automation ──────────────────────────────────────

export type EmailStatus = "PENDING" | "SENT" | "FAILED" | "CANCELLED";

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  is_active: boolean;
  rules_count: number;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailTemplateWritePayload = {
  name: string;
  subject: string;
  body_html: string;
  is_active: boolean;
};

export interface EmailRule {
  id: number;
  name: string;
  trigger_status: LeadStatus;
  trigger_status_display: string;
  template: number;
  template_name: string;
  delay_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EmailRuleWritePayload = {
  name: string;
  trigger_status: LeadStatus;
  template: number;
  delay_hours: number;
  is_active: boolean;
};

export interface ScheduledEmail {
  id: string;
  template: number | null;
  template_name: string | null;
  subject_rendered: string;
  body_rendered: string;
  to_email: string;
  send_at: string;
  status: EmailStatus;
  status_display: string;
  sent_at: string | null;
  error_message: string;
  triggered_by: number | null;
  triggered_by_username: string | null;
  rule: number | null;
  rule_name: string | null;
  created_at: string;
}

export interface EmailPreviewResponse {
  subject: string;
  body_html: string;
  lead_name: string;
}

export interface EmailThreadItem {
  id: string;
  direction: "outbound" | "inbound";
  timestamp: string;
  subject: string;
  body: string;
  from_email: string;
  to_email: string | null;
  // outbound-only
  status: EmailStatus | null;
  template_name: string | null;
  triggered_by_username: string | null;
  rule_name: string | null;
}

export interface AdminEmailQueueItem {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_company: string;
  assigned_to_username: string | null;
  assigned_to_name: string | null;
  template_name: string | null;
  subject_rendered: string;
  to_email: string;
  from_email: string;
  send_at: string;
  status: EmailStatus;
  status_display: string;
  sent_at: string | null;
  error_message: string;
  triggered_by_username: string | null;
  rule_name: string | null;
  has_reply: boolean;
  latest_reply_at: string | null;
  latest_reply_subject: string | null;
  created_at: string;
}

export interface UserEmailCredential {
  id: number;
  username: string;
  zoho_email: string;
  is_active: boolean;
  updated_at: string;
}

/** All supported merge tags, in the order shown in the UI helper chips. */
export const MERGE_TAGS = [
  { tag: "lead_name",        label: "Full name" },
  { tag: "lead_first_name",  label: "First name" },
  { tag: "lead_company",     label: "Company" },
  { tag: "lead_designation", label: "Designation" },
  { tag: "lead_email",       label: "Email" },
  { tag: "event_name",       label: "Event name" },
  { tag: "event_city",       label: "Event city" },
  { tag: "event_location",   label: "City, Country" },
  { tag: "event_date",       label: "Event date" },
  { tag: "pipeline_name",    label: "Pipeline" },
  { tag: "tier_name",        label: "Tier" },
  { tag: "sender_name",      label: "Sender" },
] as const;
