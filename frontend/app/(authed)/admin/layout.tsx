import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/ProtectedRoute";

/** Admin-only sub-layout. Sits inside (authed)/layout, so non-admins
 *  trying to load /admin/* get bounced to /leads (and unauthed users
 *  to /login by the parent layout). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}
