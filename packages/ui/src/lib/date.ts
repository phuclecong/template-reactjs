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

import { format as formatDateFns, isValid, parse as parseDateFns } from "date-fns"
import { enUS as enDateFns, vi as viDateFns } from "date-fns/locale"
import { enUS as enCalendar } from "react-day-picker/locale/en-US"
import { vi as viCalendar } from "react-day-picker/locale/vi"

import { isDateOnly, parseLocalDateOnly } from "@workspace/date-utils"

export { isDateOnly }

/** A value accepted by the formatting and boundary helpers. */
export type DateValue = string | Date | null | undefined

/** The Locales the app and its design-system call sites support. */
export type AppLocale = "en" | "vi"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/**
 * Resolves an app/i18n language tag to a supported Locale. Unknown tags and
 * regional variants fall back to English; `vi`, `vi-VN`, and similar resolve
 * to Vietnamese.
 */
export function resolveLocale(locale?: string): AppLocale {
  return locale?.toLowerCase().startsWith("vi") ? "vi" : "en"
}

/** The date-fns locale used for parsing and formatting in the given Locale. */
export function dateFnsLocale(locale?: string) {
  return resolveLocale(locale) === "vi" ? viDateFns : enDateFns
}

/** The react-day-picker locale used for calendar labels and week start. */
export function calendarLocale(locale?: string) {
  return resolveLocale(locale) === "vi" ? viCalendar : enCalendar
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
 * Builds the UTC instant for a local calendar day and wall-clock time.
 * Picking a date preserves the selected time, and changing the time preserves
 * the selected day; both paths cross the same local-to-instant boundary here.
 */
export function localDateTimeToUtcInstant(
  value: Date | string,
  hours: number,
  minutes: number
): string {
  const date = toDate(value)
  if (!date) throw new RangeError("Invalid date value")
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

/** Formats a local Date as the `HH:mm` value a time input expects. */
export function formatTimeInputValue(value: Date | null): string {
  if (!value) return ""
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
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

function intlLocale(locale?: string): string {
  return resolveLocale(locale) === "vi" ? "vi-VN" : "en-US"
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

/**
 * The localized date-fns pattern used by the picker's free-text entry. `P` is
 * the locale's numeric date and `p` its time, so English accepts
 * `MM/dd/yyyy h:mm a` while Vietnamese accepts `dd/MM/yyyy HH:mm`.
 */
export const TYPED_DATE_TIME_PATTERN = "P p"

/** Formats a Date as the picker's localized typed-entry text. */
export function formatTypedDateTime(
  value: Date | null,
  locale?: string
): string {
  if (!value) return ""
  return formatDateFns(value, TYPED_DATE_TIME_PATTERN, {
    locale: dateFnsLocale(locale),
  })
}

/** Parses the picker's localized typed-entry text, or null when invalid. */
export function parseTypedDateTime(
  value: string,
  locale?: string
): Date | null {
  const text = value.trim()
  if (!text) return null
  const date = parseDateFns(text, TYPED_DATE_TIME_PATTERN, new Date(), {
    locale: dateFnsLocale(locale),
  })
  return isValid(date) ? date : null
}

/** A concrete example of the localized typed-entry format, for the hint. */
export function typedDateTimeFormatHint(locale?: string): string {
  return formatTypedDateTime(new Date(2000, 0, 1, 0, 0, 0, 0), locale)
}
