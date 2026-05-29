import { Badge, type BadgeTone } from "./Badge";
import type { LeadStatus } from "@/lib/api/types";

export type { LeadStatus };

const STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  LEAD_ASSIGNED: "blue",
  NOT_CONNECTED: "orange",
  CALL_CONNECTED: "cyan",
  CALL_SCHEDULE: "sky",
  INFO_SENT: "indigo",
  FORM_SENT: "purple",
  PROPOSAL_SENT: "teal",
  FOLLOWUP_1: "amber",
  FOLLOWUP_2: "violet",
  FOLLOWUP_3: "brand",
  INVOICE_SENT: "lime",
  DEAL_WON: "emerald",
  DEAL_LOST: "rose",
  DECLINED: "neutral",
  NOT_QUALIFIED: "orange",
  FORM_RECEIVED: "teal",
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  LEAD_ASSIGNED: "Lead Assigned",
  NOT_CONNECTED: "Not Connected",
  CALL_CONNECTED: "Call Connected",
  CALL_SCHEDULE: "Call Schedule",
  INFO_SENT: "Info Sent",
  FORM_SENT: "Form Sent",
  PROPOSAL_SENT: "Proposal Sent",
  FOLLOWUP_1: "Follow-Up 1",
  FOLLOWUP_2: "Follow-Up 2",
  FOLLOWUP_3: "Follow-Up 3",
  INVOICE_SENT: "Invoice Sent",
  DEAL_WON: "Deal Won",
  DEAL_LOST: "Deal Lost",
  DECLINED: "Declined",
  NOT_QUALIFIED: "Not Qualified",
  FORM_RECEIVED: "Form Received",
};

export function StatusChip({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
