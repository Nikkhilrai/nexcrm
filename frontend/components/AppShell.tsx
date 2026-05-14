"use client";

import { useMemo, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, Users, Inbox, Workflow, Upload, Mail } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match path prefix when deciding if this link is active. */
  matchPrefix: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/leads", label: "Master", icon: <Inbox className="w-4 h-4" />, matchPrefix: "/leads" },
  { href: "/admin", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" />, matchPrefix: "/admin", adminOnly: true },
  { href: "/admin/pipelines", label: "Pipelines", icon: <Workflow className="w-4 h-4" />, matchPrefix: "/admin/pipelines", adminOnly: true },
  { href: "/admin/import", label: "Import", icon: <Upload className="w-4 h-4" />, matchPrefix: "/admin/import", adminOnly: true },
  { href: "/admin/email-queue", label: "Emails", icon: <Mail className="w-4 h-4" />, matchPrefix: "/admin/email-", adminOnly: true },
  { href: "/admin/users", label: "Users", icon: <Users className="w-4 h-4" />, matchPrefix: "/admin/users", adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "ADMIN"),
    [user?.role],
  );

  // /admin/users should win over /admin when both prefixes match.
  const activeHref = useMemo(() => {
    const matches = visibleItems
      .filter((i) => pathname === i.matchPrefix || pathname.startsWith(`${i.matchPrefix}/`))
      .sort((a, b) => b.matchPrefix.length - a.matchPrefix.length);
    return matches[0]?.href ?? null;
  }, [pathname, visibleItems]);

  const initials = (user?.username ?? "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
          {/* Brand */}
          <Link href="/leads" className="flex items-center shrink-0">
            <Image
              src="/brand/lextalkworld.avif"
              alt="LexTalk World"
              width={140}
              height={40}
              priority
            />
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1 flex-1">
            {visibleItems.map((item) => {
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                  )}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User cluster */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-medium text-slate-900">
                  {user?.username ?? "—"}
                </span>
                {user && (
                  <Badge tone={user.role === "ADMIN" ? "brand" : "neutral"} className="text-[10px] px-1.5 py-0">
                    {user.role}
                  </Badge>
                )}
              </div>
              <div
                aria-hidden
                className="w-8 h-8 rounded-full bg-ink-900 text-white flex items-center justify-center text-xs font-semibold"
              >
                {initials}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              leftIcon={<LogOut className="w-4 h-4" />}
              aria-label="Log out"
            >
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
