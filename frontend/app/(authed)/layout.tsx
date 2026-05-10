import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";

/** Every route under (authed) is auth-gated and wrapped in the app shell
 *  (top nav with role-aware links + user cluster). Admin-only sub-pages
 *  add their own (authed)/admin/layout.tsx for the admin role check. */
export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
