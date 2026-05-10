"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Zap, KeyRound, ListOrdered } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin/email-queue",        label: "Queue",         icon: ListOrdered },
  { href: "/admin/email-templates",    label: "Templates",     icon: Mail },
  { href: "/admin/email-rules",        label: "Trigger Rules", icon: Zap },
  { href: "/admin/email-credentials",  label: "Credentials",   icon: KeyRound },
];

export function EmailsNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              active
                ? "bg-white text-ink-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
