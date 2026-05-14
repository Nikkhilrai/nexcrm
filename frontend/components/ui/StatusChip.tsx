import { Badge, type BadgeTone } from "./Badge";
import type { LeadStatus } from "@/lib/api/types";

export type { LeadStatus };

const STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  LEAD_ASSIGNED: "blue",
  NOT_CONNECTED: "orange",
  CALL_CONNECTED: "cyan",
  INFO_SENT: "indigo",
  PROPOSAL_SENT: "teal",
  FOLLOWUP_1: "amber",
  FOLLOWUP_2: "violet",
  FOLLOWUP_3: "brand",
  INVOICE_SENT: "lime",
  DEAL_WON: "emerald",
  DEAL_LOST: "rose",
  DECLINED: "neutral",
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  LEAD_ASSIGNED: "Lead Assigned",
  NOT_CONNECTED: "Not Connected",
  CALL_CONNECTED: "Call Connected",
  INFO_SENT: "Info Sent",
  PROPOSAL_SENT: "Proposal Sent",
  FOLLOWUP_1: "Follow-Up 1",
  FOLLOWUP_2: "Follow-Up 2",
  FOLLOWUP_3: "Follow-Up 3",
  INVOICE_SENT: "Invoice Sent",
  DEAL_WON: "Deal Won",
  DEAL_LOST: "Deal Lost",
  DECLINED: "Declined",
};

export function StatusChip({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
