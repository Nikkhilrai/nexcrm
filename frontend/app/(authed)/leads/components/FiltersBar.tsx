"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge, Button, Input, Select } from "@/components/ui";
import { STATUS_LABEL } from "@/components/ui/StatusChip";
import { sortSubPipelines } from "@/lib/pipelines";
import {
  LEAD_STATUSES,
  api,
  type Event as ApiEvent,
  type LeadSource,
  type LeadStatus,
  type PackageTier,
  type SubPipeline,
} from "@/lib/api";
import { cn } from "@/lib/cn";

/** Filter values controlled by the parent page.
 *  `assignedTo: "ME" | "ANYONE"` is a UI-level choice; the page translates
 *  "ME" into the current user's id when calling the API. */
export interface FiltersValue {
  search: string;
  statuses: LeadStatus[];
  eventId: string; // "" = any
  /** Sub-pipeline id as string (Phase 2.9 — replaces productInterest enum). */
  subPipelineId: string;
  /** Tier id as string ("" = any). Cleared automatically when subPipelineId or eventId changes. */
  packageTierId: string;
  source: "" | LeadSource;
  assignedTo: "ME" | "ANYONE";
  createdAfter: string;
  createdBefore: string;
}

export const EMPTY_FILTERS: FiltersValue = {
  search: "",
  statuses: [],
  eventId: "",
  subPipelineId: "",
  packageTierId: "",
  source: "",
  assignedTo: "ANYONE",
  createdAfter: "",
  createdBefore: "",
};

const STATUS_OPTIONS: readonly LeadStatus[] = LEAD_STATUSES;

const SOURCE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "WEBSITE_FORM", label: "Website form" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "REFERRAL", label: "Referral" },
  { value: "COLD_CALL", label: "Cold call" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
];

const ASSIGNED_OPTIONS = [
  { value: "ANYONE", label: "Anyone" },
  { value: "ME", label: "Mine" },
];

interface FiltersBarProps {
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
  events: ApiEvent[];
  /** True while events list is loading — keeps the event select disabled. */
  eventsLoading?: boolean;
}

export function FiltersBar({ value, onChange, events, eventsLoading }: FiltersBarProps) {
  const [allTiers, setAllTiers] = useState<PackageTier[] | null>(null);
  const [allSubPipelines, setAllSubPipelines] = useState<SubPipeline[] | null>(null);

  // Load both lists once. Small (~15 sub-pipelines / ~63 tiers on seed data),
  // so cascading happens client-side — no extra fetch on filter change.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.tiers.list({ is_active: true }).catch(() => [] as PackageTier[]),
      api.subPipelines.list({ is_active: true }).catch(() => [] as SubPipeline[]),
    ]).then(([tiersRes, spRes]) => {
      if (cancelled) return;
      setAllTiers(tiersRes);
      setAllSubPipelines(spRes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sub-pipelines available given the current event filter. When no event
  // is picked, show every active pipeline so the user can still narrow by
  // category alone — backend will filter by sub_pipeline FK directly.
  const subPipelineOptions = useMemo(() => {
    if (!allSubPipelines) {
      return [{ value: "", label: "Loading…" }];
    }
    const scoped = value.eventId
      ? allSubPipelines.filter((sp) => sp.event === Number(value.eventId))
      : allSubPipelines;
    return [
      { value: "", label: "Any sub-pipeline" },
      ...sortSubPipelines(scoped).map((sp) => {
        // When no event filter is set we may show duplicates across events —
        // disambiguate inline so the dropdown stays readable.
        const event = events.find((e) => e.id === sp.event);
        const label = value.eventId
          ? sp.name
          : event
            ? `${sp.name} — ${event.city}`
            : sp.name;
        return { value: String(sp.id), label };
      }),
    ];
  }, [allSubPipelines, value.eventId, events]);

  const tierOptions = useMemo(() => {
    if (!value.subPipelineId || !allTiers) {
      return [{ value: "", label: "Pick a sub-pipeline first" }];
    }
    const subPipelineId = Number(value.subPipelineId);
    const filtered = allTiers
      .filter((t) => t.sub_pipeline === subPipelineId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return [
      { value: "", label: "Any tier" },
      ...filtered.map((t) => ({ value: String(t.id), label: t.name })),
    ];
  }, [allTiers, value.subPipelineId]);

  function patch<K extends keyof FiltersValue>(key: K, v: FiltersValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleStatus(s: LeadStatus) {
    const has = value.statuses.includes(s);
    patch(
      "statuses",
      has ? value.statuses.filter((x) => x !== s) : [...value.statuses, s],
    );
  }

  const eventOptions = [
    { value: "", label: eventsLoading ? "Loading events…" : "Any event" },
    ...events.map((e) => ({
      value: String(e.id),
      // Show name + city so two events with the same city (e.g. Dubai 2026 +
      // Dubai 2027) stay distinguishable in the dropdown.
      label: `${e.name} (${e.city})`,
    })),
  ];

  const hasFilters =
    value.search !== "" ||
    value.statuses.length > 0 ||
    value.eventId !== "" ||
    value.subPipelineId !== "" ||
    value.packageTierId !== "" ||
    value.source !== "" ||
    value.assignedTo !== "ANYONE" ||
    value.createdAfter !== "" ||
    value.createdBefore !== "";

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
      {/* Row 1: search + assigned + reset */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <Input
            name="search"
            label="Search"
            placeholder="Name, phone, email, company…"
            leftIcon={<Search className="w-4 h-4" />}
            value={value.search}
            onChange={(e) => patch("search", e.target.value)}
          />
        </div>
        <div className="w-32">
          <Select
            name="assignedTo"
            label="Assigned to"
            options={ASSIGNED_OPTIONS}
            value={value.assignedTo}
            onChange={(e) => patch("assignedTo", e.target.value as "ME" | "ANYONE")}
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X className="w-4 h-4" />}
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Row 2: event / sub-pipeline / tier / source */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Select
          name="eventId"
          label="Event"
          options={eventOptions}
          value={value.eventId}
          onChange={(e) =>
            // Cascade: changing event invalidates sub-pipeline + tier choices
            // since both are scoped under the event in Phase 2.9.
            onChange({
              ...value,
              eventId: e.target.value,
              subPipelineId: "",
              packageTierId: "",
            })
          }
          disabled={eventsLoading}
        />
        <Select
          name="subPipelineId"
          label="Sub-pipeline"
          options={subPipelineOptions}
          value={value.subPipelineId}
          onChange={(e) =>
            // Cascade: changing the sub-pipeline invalidates the tier.
            onChange({
              ...value,
              subPipelineId: e.target.value,
              packageTierId: "",
            })
          }
          disabled={allSubPipelines == null}
        />
        <Select
          name="packageTierId"
          label="Tier"
          options={tierOptions}
          value={value.packageTierId}
          onChange={(e) => patch("packageTierId", e.target.value)}
          disabled={!value.subPipelineId || allTiers == null}
        />
        <Select
          name="source"
          label="Source"
          options={SOURCE_OPTIONS}
          value={value.source}
          onChange={(e) => patch("source", e.target.value as FiltersValue["source"])}
        />
      </div>

      {/* Row 3: date range */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input
          name="createdAfter"
          label="Created after"
          type="date"
          value={value.createdAfter}
          onChange={(e) => patch("createdAfter", e.target.value)}
        />
        <Input
          name="createdBefore"
          label="Created before"
          type="date"
          value={value.createdBefore}
          onChange={(e) => patch("createdBefore", e.target.value)}
        />
      </div>

      {/* Row 4: status pills */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-slate-700">Status</span>
          {value.statuses.length > 0 && (
            <Badge tone="brand">{value.statuses.length} selected</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const active = value.statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  active
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900",
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
