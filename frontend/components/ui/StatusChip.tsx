import { Badge, type BadgeTone } from "./Badge";
import type { LeadStatus } from "@/lib/api/types";

export type { LeadStatus };

const STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  LEAD_ASSIGNED: "blue",
  CALL_CONNECTED: "cyan",
  INFO_SENT: "indigo",
  FOLLOWUP_1: "amber",
  FOLLOWUP_2: "violet",
  FOLLOWUP_3: "brand",
  DEAL_WON: "emerald",
  DEAL_LOST: "rose",
  DECLINED: "neutral",
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  LEAD_ASSIGNED: "Lead Assigned",
  CALL_CONNECTED: "Call Connected",
  INFO_SENT: "Info Sent",
  FOLLOWUP_1: "Follow-Up 1",
  FOLLOWUP_2: "Follow-Up 2",
  FOLLOWUP_3: "Follow-Up 3",
  DEAL_WON: "Deal Won",
  DEAL_LOST: "Deal Lost",
  DECLINED: "Declined",
};

export function StatusChip({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
