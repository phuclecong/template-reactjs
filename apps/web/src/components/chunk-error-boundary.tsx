import type { ReactNode } from "react"

import { ErrorBoundary } from "@/components/error-boundary"

type ChunkErrorBoundaryProps = {
  children: ReactNode
  /**
   * Called after the boundary clears its error, so a caller can discard the
   * failed lazy component and create a fresh one. Without it the same lazy
   * component (and its cached rejection) would render again.
   */
  onRetry?: () => void
}

/**
 * Catches render-time failures in a chunk-backed surface, including a rejecting
 * `React.lazy`, and renders a translated retry action instead of a blank
 * surface. It is a preset over the shared `ErrorBoundary`; no error-boundary
 * dependency is added.
 */
export function ChunkErrorBoundary({
  children,
  onRetry,
}: ChunkErrorBoundaryProps) {
  return <ErrorBoundary onReset={onRetry}>{children}</ErrorBoundary>
}
