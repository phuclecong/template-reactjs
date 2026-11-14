import { lazy, type ComponentType, type LazyExoticComponent } from "react"

/**
 * React's own `lazy` uses the same loose bound: components carry different
 * prop shapes, so no single prop type fits them all.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = ComponentType<any>

/** The shape a dynamic import must resolve to: one default component. */
export type ChunkModule<T extends AnyComponent> = { default: T }

/** Seam used by tests to observe reloads without navigating. */
export type RetryEnvironment = {
  /** Performs the full-page reload used after repeated import failure. */
  reload: () => void
  /** Whether a reload was already attempted in this browsing session. */
  hasReloaded: () => boolean
  /** Records that a reload is being attempted. */
  markReloaded: () => void
}

/** Marker that survives `window.location.reload()` but not a new tab. */
export const CHUNK_RELOAD_MARKER = "chunk-reload-attempted"

function defaultEnvironment(): RetryEnvironment {
  return {
    reload: () => {
      if (typeof window !== "undefined") window.location.reload()
    },
    hasReloaded: () => {
      if (typeof window === "undefined") return false
      try {
        return window.sessionStorage.getItem(CHUNK_RELOAD_MARKER) !== null
      } catch {
        return false
      }
    },
    markReloaded: () => {
      if (typeof window === "undefined") return
      try {
        window.sessionStorage.setItem(CHUNK_RELOAD_MARKER, "1")
      } catch {
        // Storage can be blocked; reload-once is best-effort in that case.
      }
    },
  }
}

/** Error thrown to the nearest error boundary when a chunk cannot be loaded. */
export class ChunkLoadError extends Error {
  constructor(cause?: unknown) {
    super("Failed to load a code chunk", { cause })
    this.name = "ChunkLoadError"
  }
}

/**
 * Loads a dynamically imported module, retrying a failed import once.
 *
 * The retry happens before the rejection reaches `React.lazy`, so the lazy
 * component never caches the first failure. If both attempts fail, the page is
 * reloaded once per browsing session; after a reload the marker survives, so a
 * still-missing chunk rejects to the error boundary instead of looping. The
 * rejection is the promise's only failure channel, so React (or a caller)
 * handles it instead of the browser reporting an unhandled rejection.
 */
export async function loadWithRetry<T>(
  importer: () => Promise<T>,
  environment: Partial<RetryEnvironment> = {}
): Promise<T> {
  const env = { ...defaultEnvironment(), ...environment }

  try {
    return await importer()
  } catch {
    try {
      return await importer()
    } catch (error) {
      if (!env.hasReloaded()) {
        env.markReloaded()
        env.reload()
      }
      throw new ChunkLoadError(error)
    }
  }
}

/**
 * `React.lazy` with one retry and a reload fallback. Accepts the same dynamic
 * import shape (`{ default: Component }`) and returns a lazy component.
 */
export function lazyWithRetry<T extends AnyComponent>(
  importer: () => Promise<ChunkModule<T>>
): LazyExoticComponent<T> {
  return lazy(() => loadWithRetry(importer))
}
