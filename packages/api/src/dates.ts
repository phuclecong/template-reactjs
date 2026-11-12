/**
 * Due-date normalization and comparison for the mock API.
 *
 * The API package stays self-contained (it must not depend on the design
 * system), so these helpers duplicate the small amount of date logic the
 * handlers need. Due dates are UTC instants. Writes only accept date-time
 * instants; the stored-record read path still interprets legacy date-only
 * values as local midnight so persisted data survives the migration.
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

/**
 * Normalizes a stored Due date to a UTC instant for reads. Legacy date-only
 * records become local midnight; null/empty/invalid becomes null.
 */
export function normalizeStoredDueDate(
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
 * Normalizes a Due date from a write request to a UTC instant. Date-only
 * values are rejected because new writes must be date-time instants; callers
 * validate the shape first (see `dueDateWriteSchema`).
 */
export function normalizeDueDateInstant(
  value: string | null | undefined
): string | null {
  if (value == null || value === "" || isDateOnly(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Parses a stored Due date (legacy or instant) to epoch milliseconds. */
export function dueDateInstant(
  value: string | null | undefined
): number | null {
  const normalized = normalizeStoredDueDate(value)
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
