/**
 * Due-date normalization and comparison for the mock API.
 *
 * The API package stays self-contained (it must not depend on the design
 * system), so these helpers duplicate the small amount of date logic the
 * handlers need. Due dates are UTC instants; legacy date-only values are
 * interpreted as local midnight, and legacy date-only filter bounds keep
 * their whole-day semantics (lower bound = start of day, upper = end of day).
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseLocalDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function isDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value)
}

/** True when a string is a valid legacy date or parseable date-time. */
export function isValidDueDateInput(value: string): boolean {
  if (value === "") return false
  if (isDateOnly(value)) return parseLocalDateOnly(value) !== null
  return !Number.isNaN(new Date(value).getTime())
}

/**
 * Normalizes a stored or incoming Due date to a UTC instant. Legacy
 * date-only values become local midnight; null/empty/invalid becomes null.
 */
export function normalizeDueDate(
  value: string | null | undefined
): string | null {
  if (value == null || value === "") return null
  if (isDateOnly(value)) {
    return parseLocalDateOnly(value)?.toISOString() ?? null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Normalizes a `dueDate_gte` / `dueDate_lte` bound to a UTC instant. A
 * date-only lower bound becomes local start of day and a date-only upper
 * bound becomes local end of day, preserving the previous whole-day filter
 * semantics while the web app still sends date-only values.
 */
export function normalizeDueDateBound(
  value: string | null | undefined,
  bound: "gte" | "lte"
): string | null {
  if (value == null || value === "") return null
  if (isDateOnly(value)) {
    const date = parseLocalDateOnly(value)
    if (!date) return null
    const normalized =
      bound === "gte"
        ? new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          )
        : new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            23,
            59,
            59,
            999
          )
    return normalized.toISOString()
  }
  return normalizeDueDate(value)
}

/** Parses a Due date (legacy or instant) to epoch milliseconds. */
export function dueDateInstant(
  value: string | null | undefined
): number | null {
  const normalized = normalizeDueDate(value)
  return normalized ? Date.parse(normalized) : null
}

/** Orders Due dates as instants, with null values last. */
export function compareDueDates(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const av = dueDateInstant(a)
  const bv = dueDateInstant(b)
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  return av - bv
}
