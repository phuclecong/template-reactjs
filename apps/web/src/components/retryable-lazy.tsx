import {
  Suspense,
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"

import { ChunkErrorBoundary } from "@/components/chunk-error-boundary"
import {
  lazyWithRetry,
  type AnyComponent,
  type ChunkModule,
} from "@/utils/lazy-with-retry"

type RetryableLazyProps<C extends AnyComponent> = {
  /** Stable dynamic import (for example an entry in a loader map). */
  loader: () => Promise<ChunkModule<C>>
  /** Props forwarded to the lazily loaded component. */
  props: ComponentProps<C>
  /** Suspense fallback; overlays may render nothing rather than a skeleton. */
  fallback?: ReactNode
}

/**
 * Renders a lazily imported component behind a chunk error boundary.
 *
 * A retry replaces the lazy component with a fresh identity. That is
 * deliberate: `React.lazy` caches its loader's rejection, so resetting the
 * boundary alone would replay the cached failure. Creating the replacement in
 * the retry handler (not during render) gives the next attempt a clean loader.
 * `loader` must be stable; the loader maps used by this app are module-level.
 */
export function RetryableLazy<C extends AnyComponent>({
  loader,
  props,
  fallback = null,
}: RetryableLazyProps<C>) {
  const [Component, setComponent] = useState(() => lazyWithRetry(loader))

  const retry = useCallback(() => {
    setComponent(() => lazyWithRetry(loader))
  }, [loader])

  return (
    <ChunkErrorBoundary onRetry={retry}>
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    </ChunkErrorBoundary>
  )
}
