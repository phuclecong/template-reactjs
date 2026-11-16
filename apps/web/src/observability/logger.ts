import { getAnalyticsSessionId } from "./session"

export type LogLevel = "debug" | "info" | "warn" | "error"

export type Context = {
  sessionId: string
  path: string
  userAgent: string
  env: "development" | "production" | "test"
}

export type LogEntry = {
  timestamp: string
  level: LogLevel
  kind: "log"
  message: string
  context: Context
  data?: Record<string, unknown>
}

export type MetricEntry = {
  timestamp: string
  level: "info"
  kind: "metric"
  context: Context
  metric: {
    name: "LCP" | "CLS" | "INP"
    value: number
    rating: "good" | "needs-improvement" | "poor"
  }
}

export type EventEntry = {
  timestamp: string
  level: "info"
  kind: "event"
  context: Context
  event: string
  data?: Record<string, unknown>
}

export type Entry = LogEntry | MetricEntry | EventEntry

export type LogSink = (entry: Entry) => void

function resolveEnv(): Context["env"] {
  if (import.meta.env.MODE === "test") return "test"
  if (import.meta.env.DEV) return "development"
  return "production"
}

function buildContext(): Context {
  return {
    sessionId: getAnalyticsSessionId(),
    // Only the pathname is read; query strings and fragments carry user input.
    path: typeof window !== "undefined" ? window.location.pathname : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    env: resolveEnv(),
  }
}

/**
 * Converts call-site data into a `JSON.stringify`-safe value. Errors keep their
 * name/message/stack, circular references become `"[Circular]"`, and functions
 * and symbols are omitted.
 */
function safeSerialize(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (value === null) return null

  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "bigint") return value.toString()
  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return undefined
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== "object") return String(value)

  const object = value as object
  if (seen.has(object)) return "[Circular]"
  seen.add(object)

  const result: unknown = Array.isArray(object)
    ? object.map((item) => safeSerialize(item, seen) ?? null)
    : Object.fromEntries(
        Object.entries(object).flatMap(([key, item]) => {
          const serialized = safeSerialize(item, seen)
          return serialized === undefined ? [] : [[key, serialized]]
        })
      )

  // A repeated, non-circular reference is not circular; only ancestors are.
  seen.delete(object)
  return result
}

function serializeData(
  data: Record<string, unknown>
): Record<string, unknown> {
  return safeSerialize(data) as Record<string, unknown>
}

const consoleSink: LogSink = (entry) => {
  console[entry.level](entry)
}

let sink: LogSink | undefined

/**
 * Replaces the module-level sink. Calling it with no argument restores the
 * console sink, so tests and a future transport can swap it back.
 */
export function setSink(nextSink?: LogSink): void {
  sink = nextSink
}

function emit(entry: Entry): void {
  try {
    ;(sink ?? consoleSink)(entry)
  } catch {
    // A broken sink must not break the app or recurse into logging.
  }
}

/** Module-owned envelope shared by every entry kind. */
function envelope(): Pick<Entry, "timestamp" | "context"> {
  return {
    timestamp: new Date().toISOString(),
    // Context is written by the module, never by the call site.
    context: buildContext(),
  }
}

function callSiteData(
  data?: Record<string, unknown>
): { data?: Record<string, unknown> } {
  return data === undefined ? {} : { data: serializeData(data) }
}

export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  // Debug is noisy in the field; only development keeps it.
  if (level === "debug" && resolveEnv() !== "development") return

  emit({
    ...envelope(),
    level,
    kind: "log",
    message,
    ...callSiteData(data),
  })
}

/** Internal seam for `track`; not part of the module's public surface. */
export function reportEvent(
  event: string,
  data?: Record<string, unknown>
): void {
  emit({
    ...envelope(),
    level: "info",
    kind: "event",
    event,
    ...callSiteData(data),
  })
}

/** Internal seam for `installWebVitals`; not part of the public surface. */
export function reportMetric(metric: MetricEntry["metric"]): void {
  emit({
    ...envelope(),
    level: "info",
    kind: "metric",
    metric,
  })
}
