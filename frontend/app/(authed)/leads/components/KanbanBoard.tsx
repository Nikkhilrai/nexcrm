"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AlertCircle } from "lucide-react";

import { StatusChangeModal } from "@/components/StatusChangeModal";
import { LEAD_STATUSES, type LeadListItem, type LeadStatus } from "@/lib/api";

import { KanbanColumn } from "./KanbanColumn";

export interface KanbanBoardProps {
  leads: LeadListItem[];
  /**
   * Persistence callback. Resolves on success, rejects on API failure.
   * Caller is responsible for rolling back optimistic state on rejection.
   * The board surfaces an inline error banner on rejection.
   */
  onMove: (leadId: string, newStatus: LeadStatus, comment: string) => Promise<void>;
}

interface PendingMove {
  lead: LeadListItem;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
}

/**
 * Drag-and-drop kanban board. 9 columns, one per stage.
 *
 * UX:
 *  - Drag a card's grip handle (left edge) into another column.
 *  - On drop, a confirm modal asks for a comment (backend requires
 *    `status_change_comment` on every status flip — same audit rule
 *    the LeadForm enforces).
 *  - On confirm, parent's `onMove` runs with optimistic state already
 *    flipped on the parent side. If `onMove` rejects, parent rolls
 *    back the lead's status; we surface a banner.
 *
 * Why a modal instead of inline-comment-on-drop:
 *  - Same audit pattern across LeadForm and kanban → callers learn one flow.
 *  - Drag-drop is undo-friendly: the user can cancel before persisting.
 */
export function KanbanBoard({ leads, onMove }: KanbanBoardProps) {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 5px activation distance — lets the user click the card body (which
  // navigates to /leads/[id]) without accidentally starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, LeadListItem[]> = {
      LEAD_ASSIGNED: [],
      NOT_CONNECTED: [],
      CALL_CONNECTED: [],
      CALL_SCHEDULE: [],
      INFO_SENT: [],
      FORM_SENT: [],
      PROPOSAL_SENT: [],
      FOLLOWUP_1: [],
      FOLLOWUP_2: [],
      FOLLOWUP_3: [],
      INVOICE_SENT: [],
      DEAL_WON: [],
      DEAL_LOST: [],
      DECLINED: [],
      NOT_QUALIFIED: [],
      FORM_RECEIVED: [],
    };
    for (const l of leads) {
      map[l.status].push(l);
    }
    return map;
  }, [leads]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;
    const target = over.id as LeadStatus;
    if (target === lead.status) return; // dropped on same column → no-op
    setErrorMsg(null);
    setPending({ lead, fromStatus: lead.status, toStatus: target });
  }

  async function handleConfirm(comment: string) {
    if (!pending) return;
    setSaving(true);
    try {
      await onMove(pending.lead.id, pending.toStatus, comment);
      setPending(null);
    } catch (e: unknown) {
      // Parent rolled back; surface a banner so the user knows why the
      // card snapped back.
      setErrorMsg(
        e instanceof Error
          ? `Couldn't update: ${e.message}`
          : "Couldn't update the lead. Try again.",
      );
      setPending(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-4 py-2.5 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="inline-flex gap-3 min-w-full">
            {LEAD_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={grouped[status]}
                cardsDisabled={saving}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {pending && (
        <StatusChangeModal
          open
          leadName={pending.lead.full_name}
          fromStatus={pending.fromStatus}
          toStatus={pending.toStatus}
          saving={saving}
          onCancel={() => !saving && setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
