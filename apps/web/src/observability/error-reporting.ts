import { log } from "./logger"

export type ErrorContext = { componentStack?: string }

/** Coerces any thrown value into an `Error` without changing an existing one. */
export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Single reporting seam for uncaught errors, unhandled rejections, and caught
 * render errors. It emits a structured `error` entry through the shared logger,
 * whose console sink still calls `console.error`.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  const normalized = normalizeError(error)

  log("error", normalized.message, {
    error: normalized,
    ...(context?.componentStack === undefined
      ? {}
      : { componentStack: context.componentStack }),
  })
}

/**
 * Reports unhandled promise rejections without calling `preventDefault`, so the
 * browser's own reporting stays intact. The target is injectable for tests.
 */
export function installUnhandledRejectionReporter(
  target: Pick<Window, "addEventListener"> = window
): void {
  target.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason)
  })
}
