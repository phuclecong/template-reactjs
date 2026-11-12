/**
 * Date helpers for the design system.
 *
 * Task Due dates are stored as UTC instants (ISO 8601 with `Z`) and displayed
 * in the viewer's local timezone (ADR 0007). These helpers are the single
 * place where the boundary between a UTC instant and a local calendar day is
 * crossed: form values and filter bounds stay date-only, while payloads and
 * stored records are instants.
 *
 * All "local" operations use the runtime's timezone (`Date`), so day
 * boundaries automatically account for the current offset and DST.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** A value accepted by the formatting and boundary helpers. */
export type DateValue = string | Date | null | undefined

/** True for a `YYYY-MM-DD` calendar date with no time component. */
export function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value)
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** Parses `YYYY-MM-DD` as local midnight, rejecting overflowed dates. */
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

/**
 * Parses a `YYYY-MM-DD` date-only string as a local-midnight Date, or null
 * when the value is not a valid calendar date. Calendar primitives select days
 * as Date objects, so this is the bridge from filter bounds to their model.
 */
export function dateOnlyToLocalDate(
  value: string | null | undefined
): Date | null {
  if (!isDateOnly(value)) return null
  return parseLocalDateOnly(value)
}

/** Serializes a Date as the local calendar date (`YYYY-MM-DD`) it falls on. */
export function localDateToDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Converts a value to a Date. Date-only strings are interpreted as local
 * midnight (a calendar day), while instants keep their absolute moment.
 */
function toDate(value: DateValue): Date | null {
  if (value == null || value === "") return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (isDateOnly(value)) return parseLocalDateOnly(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Parses an ISO 8601 instant into a Date, or null when invalid. */
export function parseUtcInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Serializes a Date as an ISO 8601 UTC instant (`...Z`). */
export function serializeUtcInstant(date: Date): string {
  return date.toISOString()
}

/**
 * Normalizes a stored value, accepting legacy date-only records. A date-only
 * value becomes local midnight as a UTC instant; an existing instant is kept.
 * Returns null for empty or invalid input.
 */
export function normalizeLegacyDateValue(
  value: string | null | undefined
): string | null {
  if (isDateOnly(value)) {
    return localStartOfDayUtcInstant(value)
  }
  return parseUtcInstant(value)?.toISOString() ?? null
}

/** Converts a local calendar day to its start-of-day UTC instant. */
export function localStartOfDayUtcInstant(value: Date | string): string {
  const date = toDate(value)
  if (!date) throw new RangeError("Invalid date value")
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

/** Converts a local calendar day to its end-of-day UTC instant. */
export function localEndOfDayUtcInstant(value: Date | string): string {
  const date = toDate(value)
  if (!date) throw new RangeError("Invalid date value")
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
 * Serializes a value for a write payload as a UTC instant. Only date-time
 * values are accepted; legacy date-only values return null so new writes
 * cannot silently create date-only records. Read-side compatibility lives in
 * `normalizeLegacyDateValue`.
 */
export function toUtcInstant(
  value: string | null | undefined
): string | null {
  if (!value || isDateOnly(value)) return null
  return parseUtcInstant(value)?.toISOString() ?? null
}

function intlLocale(locale: string): string {
  if (locale === "en") return "en-US"
  if (locale === "vi") return "vi-VN"
  return locale
}

function formatWith(
  value: DateValue,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = toDate(value)
  if (!date) return ""
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date)
}

/** Formats an instant or local calendar day as a medium-length date. */
export function formatDate(value: DateValue, locale: string): string {
  return formatWith(value, locale, { dateStyle: "medium" })
}

/** Formats an instant as a short time in the runtime's timezone. */
export function formatTime(value: DateValue, locale: string): string {
  return formatWith(value, locale, { timeStyle: "short" })
}

/** Formats an instant as a medium-length date and short time. */
export function formatDateTime(value: DateValue, locale: string): string {
  return formatWith(value, locale, { dateStyle: "medium", timeStyle: "short" })
}

/**
 * Formats a date range, falling back to the single bound that exists and to
 * an empty string when neither does.
 */
export function formatDateRange(
  from: DateValue,
  to: DateValue,
  locale: string
): string {
  const fromDate = toDate(from)
  const toDateValue = toDate(to)
  if (!fromDate && !toDateValue) return ""
  if (!fromDate) return formatDate(to, locale)
  if (!toDateValue) return formatDate(from, locale)
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
  }).formatRange(fromDate, toDateValue)
}
