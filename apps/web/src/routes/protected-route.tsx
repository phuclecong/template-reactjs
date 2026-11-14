import { Navigate, Outlet } from "react-router-dom"
import { useIsAuthenticated } from "@refinedev/core"

import {
  AppShellSkeleton,
  AuthPageSkeleton,
} from "@/components/page-skeletons"

/**
 * Client-side route gating (ADR-0003, formerly Next's `proxy.ts`). Uses Refine's
 * auth `check` to bounce unauthenticated visitors away from protected routes.
 * Gates navigation only; data authorization lives in the API.
 *
 * While the check runs it paints a neutral shell frame rather than `null`, so a
 * cold visitor never sees a blank page; the frame contains no identity or data.
 */
export function ProtectedRoute() {
  const { data, isLoading } = useIsAuthenticated()

  if (isLoading) return <AppShellSkeleton />
  if (!data?.authenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Inverse gate: bounces already-authenticated visitors away from auth pages. */
export function RedirectIfAuthed() {
  const { data, isLoading } = useIsAuthenticated()

  if (isLoading) return <AuthPageSkeleton />
  if (data?.authenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
