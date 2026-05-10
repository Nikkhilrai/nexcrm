"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Briefcase, GripVertical, MessageSquareQuote, Phone } from "lucide-react";

import { cn } from "@/lib/cn";
import type { LeadListItem } from "@/lib/api";

export interface KanbanCardProps {
  lead: LeadListItem;
  /** Disable drag handle (used while a status change is in flight). */
  disabled?: boolean;
}

const SOURCE_LABEL: Record<LeadListItem["source"], string> = {
  WEBSITE_FORM: "Website",
  LINKEDIN: "LinkedIn",
  REFERRAL: "Referral",
  COLD_CALL: "Cold call",
  EMAIL: "Email",
  OTHER: "Other",
};

/** Friendly relative time ("3d ago", "just now"). Pure client side — no
 *  external lib for one usage. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) {
    const m = Math.round(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.round(diffSec / 3600);
    return `${h}h ago`;
  }
  const d = Math.round(diffSec / 86400);
  if (d < 30) return `${d}d ago`;
  const months = Math.round(d / 30);
  return `${months}mo ago`;
}

/**
 * Single lead card on the kanban board.
 *
 * Layout (top → bottom):
 *  - Drag handle (left edge, w-6) + click body opens /leads/[id]
 *  - Name (bold) + designation underneath + company
 *  - Tier chip + source pill row
 *  - Phone (mono)
 *  - **Status note block** — comment, who, when. Comment truncated at 2 lines
 *    with ellipsis so cards in a column stay roughly comparable in height.
 *    Block hidden entirely when the lead has no comment yet.
 *  - Footer: assigned + next-followup
 *
 * The handle is what's draggable, NOT the whole card — body is a normal
 * `<Link>` so click-vs-drag is unambiguous.
 */
export function KanbanCard({ lead, disabled }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled,
    data: { lead },
  });

  const overdue =
    lead.next_followup_at && new Date(lead.next_followup_at).getTime() < Date.now();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group relative bg-white rounded-lg border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all",
        isDragging && "opacity-50 shadow-lg cursor-grabbing",
      )}
    >
      <button
        type="button"
        aria-label="Drag to move"
        {...listeners}
        {...attributes}
        disabled={disabled}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing rounded-l-lg",
          disabled && "cursor-not-allowed opacity-30",
        )}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <Link href={`/leads/${lead.id}`} className="block pl-7 pr-3 py-3 text-sm space-y-2">
        {/* Identity */}
        <div>
          <div className="font-semibold text-ink-900 truncate">{lead.full_name}</div>
          {lead.designation && (
            <div className="text-xs text-slate-600 truncate flex items-center gap-1 mt-0.5">
              <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
              {lead.designation}
            </div>
          )}
          {lead.company && (
            <div className="text-xs text-slate-500 truncate mt-0.5">{lead.company}</div>
          )}
        </div>

        {/* Tier + source row */}
        {(lead.package_tier_name || lead.source) && (
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            {lead.package_tier_name && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium uppercase tracking-wide border border-brand-100">
                {lead.package_tier_name}
              </span>
            )}
            {lead.source && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
                {SOURCE_LABEL[lead.source]}
              </span>
            )}
          </div>
        )}

        {/* Phone */}
        <div className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" />
          {lead.phone}
        </div>

        {/* Status note block — only when there's actually a comment */}
        {lead.latest_status_note && (
          <div className="bg-slate-50 border-l-2 border-brand-300 rounded-r px-2 py-1.5 text-xs">
            <div className="flex items-start gap-1.5 text-slate-700">
              <MessageSquareQuote className="w-3 h-3 mt-0.5 shrink-0 text-brand-500" />
              {/* line-clamp-2 truncates at 2 lines with ellipsis */}
              <p className="line-clamp-2 leading-snug">
                {lead.latest_status_note.comment}
              </p>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 pl-[18px]">
              {lead.latest_status_note.changed_by_username ?? "system"} ·{" "}
              {relativeTime(lead.latest_status_note.changed_at)}
            </div>
          </div>
        )}

        {/* Footer: assigned + next followup */}
        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
          <span className={lead.assigned_to_username ? "text-slate-600" : "text-slate-400 italic"}>
            {lead.assigned_to_username ?? "unassigned"}
          </span>
          {lead.next_followup_at && (
            <span className={overdue ? "text-rose-700 font-medium" : "text-slate-500"}>
              {new Date(lead.next_followup_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
