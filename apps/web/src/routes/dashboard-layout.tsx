import { Outlet } from "react-router-dom"
import { useGetIdentity } from "@refinedev/core"

import { AppShellSkeleton } from "@/components/page-skeletons"
import { DashboardShell } from "@/components/dashboard-shell"
import type { DashboardUser } from "@/providers/auth-provider"

/**
 * Shared layout for every authenticated route: the collapsible sidebar + shell
 * around the nested route. The `ProtectedRoute` gate already ran, so the
 * identity is held in memory here. Until it resolves, paint the same neutral
 * frame as the auth gate instead of a blank screen.
 */
export function DashboardLayout() {
  const { data: identity, isLoading } = useGetIdentity<DashboardUser>()

  if (isLoading || !identity) return <AppShellSkeleton />

  return (
    <DashboardShell user={identity}>
      <Outlet />
    </DashboardShell>
  )
}
