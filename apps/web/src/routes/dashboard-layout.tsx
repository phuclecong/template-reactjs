import { Outlet } from "react-router-dom"
import { useGetIdentity } from "@refinedev/core"

import { DashboardShell } from "@/components/dashboard-shell"
import type { DashboardUser } from "@/providers/auth-provider"

/**
 * Shared layout for every `/dashboard/*` route: the collapsible sidebar + shell
 * around the nested route. The `ProtectedRoute` gate already ran, so the
 * identity is held in memory here.
 */
export function DashboardLayout() {
  const { data: identity, isLoading } = useGetIdentity<DashboardUser>()

  if (isLoading || !identity) return null

  return (
    <DashboardShell user={identity}>
      <Outlet />
    </DashboardShell>
  )
}
