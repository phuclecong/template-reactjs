/**
 * Dependency-free date boundary shared by the API, the design system, and the
 * URL/filter adapters.
 *
 * Task Due dates are stored as UTC instants and interpreted as local calendar
 * days at their edges (ADR-0007). This package owns that rule: legacy
 * normalization for reads, write normalization, and the local start/end-of-day
 * conversion. Display formatting and locale-aware helpers stay in `ui`.
 *
 * All "local" operations use the runtime's timezone (`Date`), so day
 * boundaries follow the current offset and DST.
 *
 * Every helper returns `null` for invalid input, including an overflowed
 * calendar day such as `2026-02-31`; none of them throw. Callers treat `null`
 * as "no value" or "no bound".
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a `YYYY-MM-DD` calendar date with no time component. */
export function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value)
}

/**
 * Parses `YYYY-MM-DD` as local midnight, returning null for invalid input or
 * an overflowed date such as `2026-02-31`.
 */
export function parseLocalDateOnly(value: string): Date | null {
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

/**
 * Parses a date-only value as local midnight. Unlike `parseLocalDateOnly`,
 * this accepts absent input and returns null for anything that is not a valid
 * `YYYY-MM-DD` calendar day, including `2026-02-31`.
 */
export function dateOnlyToLocalDate(
  value: string | null | undefined
): Date | null {
  if (!isDateOnly(value)) return null
  return parseLocalDateOnly(value)
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** Serializes a Date as the local calendar date (`YYYY-MM-DD`) it falls on. */
export function localDateToDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Converts a Date or date string to a local Date. Date-only values are
 * validated as calendar days; other strings are parsed as instants. Returns
 * null for empty or invalid input.
 */
function toLocalDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (isDateOnly(value)) return parseLocalDateOnly(value)
  if (value === "") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Converts a local calendar day to its start-of-day UTC instant, or null when
 * the value is not a valid date.
 */
export function localStartOfDayUtcInstant(value: Date | string): string | null {
  const date = toLocalDate(value)
  if (!date) return null
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  ).toISOString()
}

/**
 * Converts a local calendar day to its end-of-day UTC instant, or null when
 * the value is not a valid date.
 */
export function localEndOfDayUtcInstant(value: Date | string): string | null {
  const date = toLocalDate(value)
  if (!date) return null
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  ).toISOString()
}

/**
 * Builds the UTC instant for a local calendar day and wall-clock time, or null
 * when the value is not a valid date. Picking a date preserves the selected
 * time, and changing the time preserves the selected day; both paths cross
 * this boundary here.
 */
export function localDateTimeToUtcInstant(
  value: Date | string,
  hours: number,
  minutes: number
): string | null {
  const date = toLocalDate(value)
  if (!date) return null
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  ).toISOString()
}

/**
 * Normalizes a stored value for reads. A legacy date-only record becomes local
 * midnight as a UTC instant; an existing instant is canonicalized to UTC.
 * Empty, invalid, and overflowed values become null.
 */
export function normalizeStoredDateValue(
  value: string | null | undefined
): string | null {
  if (value == null || value === "") return null
  if (isDateOnly(value)) return localStartOfDayUtcInstant(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Normalizes a value for a write payload to a UTC instant. Date-only values are
 * rejected (null) because new writes must carry a date-time; empty, invalid,
 * and overflowed values also become null.
 */
export function normalizeInstantValue(
  value: string | null | undefined
): string | null {
  if (value == null || value === "" || isDateOnly(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
