"use client";

import { Users, Trophy, Banknote, Timer, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import type { DashboardKpis } from "@/lib/api";

interface KpiGridProps {
  kpis: DashboardKpis;
}

interface KpiTile {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent: string;
}

function fmtINR(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtUSD(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return "";
  return `$${n.toLocaleString("en-US")}`;
}

export function KpiGrid({ kpis }: KpiGridProps) {
  const usdHint = fmtUSD(kpis.revenue_month_usd);

  const tiles: KpiTile[] = [
    {
      label: "Leads",
      value: String(kpis.leads_month),
      icon: Users,
      accent: "bg-brand-50 text-brand-700",
    },
    {
      label: "Conversions",
      value: String(kpis.conversions_month),
      icon: Trophy,
      accent: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Revenue (₹)",
      value: fmtINR(kpis.revenue_month_inr),
      hint: usdHint ? `+ ${usdHint} in USD` : undefined,
      icon: Banknote,
      accent: "bg-amber-50 text-amber-700",
    },
    {
      label: "Avg days to close",
      value: kpis.avg_conversion_days != null ? kpis.avg_conversion_days.toFixed(1) : "—",
      hint: "Created → WON",
      icon: Timer,
      accent: "bg-indigo-50 text-indigo-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <Card key={t.label} padding="tight">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                {t.label}
              </p>
              <p className="font-heading text-2xl text-ink-900 mt-1">{t.value}</p>
            </div>
            <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${t.accent}`}>
              <t.icon className="w-5 h-5" />
            </span>
          </div>
          {t.hint && <p className="text-[11px] text-slate-500 mt-2">{t.hint}</p>}
        </Card>
      ))}
    </div>
  );
}
