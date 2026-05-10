"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";

interface ProtectedRouteProps {
  children: ReactNode;
  /** When true, only ADMIN role users can render. Others get redirected to /leads. */
  requireAdmin?: boolean;
}

/** Client-side route guard. Pair with the (authed) layout group so every
 *  page underneath is auto-protected. Redirects:
 *   - not signed in → /login
 *   - signed in, not admin, requireAdmin=true → /leads
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && user.role !== "ADMIN") {
      router.replace("/leads");
    }
  }, [user, loading, requireAdmin, router]);

  if (loading || !user || (requireAdmin && user.role !== "ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" label="Loading…" />
      </div>
    );
  }

  return <>{children}</>;
}
