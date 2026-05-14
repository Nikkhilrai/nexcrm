"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/components/ui";
import { StatusChip } from "@/components/ui/StatusChip";
import type { DashboardRecentLead } from "@/lib/api";

interface RecentLeadsProps {
  leads: DashboardRecentLead[];
  monthLabel: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RecentLeads({ leads, monthLabel }: RecentLeadsProps) {
  return (
    <Card
      title="Recent leads"
      description={`Latest leads added in ${monthLabel}.`}
      padding="none"
    >
      {leads.length === 0 ? (
        <p className="text-sm text-slate-500 italic px-4 py-4">
          No leads created this month yet.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-ink-900 truncate">
                    {lead.full_name}
                  </span>
                  {lead.company && (
                    <span className="text-xs text-slate-500 truncate">
                      · {lead.company}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {lead.sub_pipeline_name && (
                    <span className="text-[11px] text-slate-400">
                      {lead.sub_pipeline_name}
                    </span>
                  )}
                  {lead.assigned_to_username && (
                    <span className="text-[11px] text-slate-400">
                      · @{lead.assigned_to_username}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    · {timeAgo(lead.created_at)}
                  </span>
                </div>
              </div>
              <StatusChip status={lead.status} />
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
