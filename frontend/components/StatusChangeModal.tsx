"use client";

import { useEffect, useState } from "react";

import { Button, Modal, Textarea } from "@/components/ui";
import { STATUS_LABEL } from "@/components/ui/StatusChip";
import type { LeadStatus } from "@/lib/api";

export interface StatusChangeModalProps {
  open: boolean;
  /** Lead's display name — for the modal description. */
  leadName: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  /** Set true while the parent's PATCH is in flight. */
  saving?: boolean;
  /** Cancel — fires when the user dismisses without confirming. */
  onCancel: () => void;
  /** Confirm — fires with the comment text once the user clicks save. */
  onConfirm: (comment: string) => void;
}

/**
 * Reusable confirm-modal for any status flip. Backend requires a non-empty
 * `status_change_comment` whenever a lead's status changes; this modal
 * captures it. Used by:
 *   - LeadForm (edit page) on save when status differs from original
 *   - KanbanBoard on drop into a different column
 *
 * Resets the comment field every time it opens so a previous cancellation
 * doesn't leak into the next attempt.
 */
export function StatusChangeModal({
  open,
  leadName,
  fromStatus,
  toStatus,
  saving = false,
  onCancel,
  onConfirm,
}: StatusChangeModalProps) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) setComment("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={() => !saving && onCancel()}
      title="Confirm status change"
      description={`Moving ${leadName} from ${STATUS_LABEL[fromStatus]} → ${STATUS_LABEL[toStatus]}. Add a short note for the audit log.`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!comment.trim()}
            onClick={() => onConfirm(comment.trim())}
          >
            Confirm & save
          </Button>
        </>
      }
    >
      <Textarea
        label="Status change comment"
        name="status_change_comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="e.g. Sent decklink over WhatsApp, awaiting reply."
        rows={3}
        autoFocus
      />
    </Modal>
  );
}
