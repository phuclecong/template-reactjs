import { Outlet } from "react-router-dom"
import { useGetIdentity } from "@refinedev/core"

import { AppShellSkeleton } from "@/components/page-skeletons"
import { AppShell } from "@/components/app-shell"
import type { ShellUser } from "@/providers/auth-provider"

/**
 * Shared layout for every authenticated route: the app shell
 * around the nested route. The `ProtectedRoute` gate already ran, so the
 * identity is held in memory here. Until it resolves, paint the same neutral
 * frame as the auth gate instead of a blank screen.
 */
export function AppShellLayout() {
  const { data: identity, isLoading } = useGetIdentity<ShellUser>()

  if (isLoading || !identity) return <AppShellSkeleton />

  return (
    <AppShell user={identity}>
      <Outlet />
    </AppShell>
  )
}
