import { Navigate, Outlet } from "react-router-dom"
import { useIsAuthenticated } from "@refinedev/core"

/**
 * Client-side route gating (ADR-0003, formerly Next's `proxy.ts`). Uses Refine's
 * auth `check` to bounce unauthenticated visitors away from protected routes.
 * Gates navigation only; data authorization lives in the API.
 */
export function ProtectedRoute() {
  const { data, isLoading } = useIsAuthenticated()

  if (isLoading) return null
  if (!data?.authenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Inverse gate: bounces already-authenticated visitors away from auth pages. */
export function RedirectIfAuthed() {
  const { data, isLoading } = useIsAuthenticated()

  if (isLoading) return null
  if (data?.authenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
