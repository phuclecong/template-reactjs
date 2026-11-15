export type ErrorContext = { componentStack?: string }

/** Coerces any thrown value into an `Error` without changing an existing one. */
export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** Single reporting seam; a telemetry vendor can replace the console sink. */
export function reportError(error: unknown, context?: ErrorContext): void {
  const normalized = normalizeError(error)

  if (context?.componentStack) {
    console.error(normalized, context.componentStack)
    return
  }

  console.error(normalized)
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
