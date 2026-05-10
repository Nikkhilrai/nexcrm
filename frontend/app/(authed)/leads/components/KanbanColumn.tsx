"use client";

import { useDroppable } from "@dnd-kit/core";

import { STATUS_LABEL } from "@/components/ui/StatusChip";
import { cn } from "@/lib/cn";
import type { LeadListItem, LeadStatus } from "@/lib/api";

import { KanbanCard } from "./KanbanCard";

export interface KanbanColumnProps {
  status: LeadStatus;
  leads: LeadListItem[];
  /** Disables drag handles on this column's cards while a save is in flight. */
  cardsDisabled?: boolean;
}

/**
 * Single droppable kanban column. Highlights when a card is hovered over it.
 * The empty-state copy is also a valid drop target so an empty column can
 * receive its first card.
 */
export function KanbanColumn({ status, leads, cardsDisabled }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-80 shrink-0 bg-slate-100 rounded-xl flex flex-col max-h-[calc(100vh-16rem)] transition-colors",
        isOver && "bg-brand-50 ring-2 ring-brand-300",
      )}
    >
      <header className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          {STATUS_LABEL[status]}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white text-[10px] font-medium text-slate-600 border border-slate-200">
          {leads.length}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {leads.length === 0 ? (
          <div className="text-center text-xs text-slate-400 italic py-6">
            Drop a lead here.
          </div>
        ) : (
          leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} disabled={cardsDisabled} />
          ))
        )}
      </div>
    </div>
  );
}
