/**
 * Due-date normalization and comparison for the mock API.
 *
 * The API package must not depend on the design system; the read/write
 * normalizers live in `@workspace/date-utils`, which owns ADR-0007's local-day
 * to UTC-instant rule. Due dates are UTC instants. Writes only accept
 * date-time instants; the stored-record read path still interprets legacy
 * date-only values as local midnight so persisted data survives the migration.
 */

import {
  normalizeInstantValue,
  normalizeStoredDateValue,
} from "@workspace/date-utils"

/**
 * Normalizes a stored Due date to a UTC instant for reads. Legacy date-only
 * records become local midnight; null/empty/invalid/overflowed becomes null.
 */
export function normalizeStoredDueDate(
  value: string | null | undefined
): string | null {
  return normalizeStoredDateValue(value)
}

/**
 * Normalizes a Due date from a write request to a UTC instant. Date-only
 * values are rejected because new writes must be date-time instants; callers
 * validate the shape first (see `dueDateWriteSchema`).
 */
export function normalizeDueDateInstant(
  value: string | null | undefined
): string | null {
  return normalizeInstantValue(value)
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
