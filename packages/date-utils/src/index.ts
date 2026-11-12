/**
 * Dependency-free date-only parsing shared by the API and the design system.
 *
 * Both packages need to recognise a legacy `YYYY-MM-DD` value and interpret it
 * as a local calendar day. Keeping that primitive in one small workspace
 * package avoids two copies drifting apart; everything timezone- or
 * locale-aware lives in the consuming package.
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
