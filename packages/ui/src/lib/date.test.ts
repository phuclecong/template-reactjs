import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  dateOnlyToLocalDate,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatTime,
  isDateOnly,
  localDateToDateOnly,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
  normalizeLegacyDateValue,
  parseUtcInstant,
  serializeUtcInstant,
  toUtcInstant,
} from "./date"

const originalTimeZone = process.env.TZ

// Intl's range formatter separates the shared parts with a thin space
// (U+2009); normalize it so the expectation reads naturally and does not
// depend on a particular ICU version's spacing choice.
function normalizeSpaces(value: string): string {
  return value.replace(/ | /g, " ")
}

beforeEach(() => {
  process.env.TZ = "UTC"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

describe("UTC instant parsing and serialization", () => {
  it("serializes a Date as an ISO 8601 UTC instant", () => {
    expect(serializeUtcInstant(new Date("2026-01-05T00:00:00.000Z"))).toBe(
      "2026-01-05T00:00:00.000Z"
    )
  })

  it("parses a UTC instant and rejects invalid input", () => {
    expect(parseUtcInstant("2026-01-05T12:30:00.000Z")?.toISOString()).toBe(
      "2026-01-05T12:30:00.000Z"
    )
    expect(parseUtcInstant("not-a-date")).toBeNull()
    expect(parseUtcInstant("")).toBeNull()
    expect(parseUtcInstant(null)).toBeNull()
  })

  it("recognises date-only values", () => {
    expect(isDateOnly("2026-01-05")).toBe(true)
    expect(isDateOnly("2026-01-05T00:00:00.000Z")).toBe(false)
    expect(isDateOnly("05/01/2026")).toBe(false)
  })
})

describe("calendar date helpers", () => {
  it("parses a date-only value as local midnight", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    const date = dateOnlyToLocalDate("2026-01-05")
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(0)
    expect(date?.getDate()).toBe(5)
    expect(date?.getHours()).toBe(0)
  })

  it("rejects invalid date-only values", () => {
    expect(dateOnlyToLocalDate("2026-02-31")).toBeNull()
    expect(dateOnlyToLocalDate("2026-01-05T00:00:00.000Z")).toBeNull()
    expect(dateOnlyToLocalDate("")).toBeNull()
    expect(dateOnlyToLocalDate(null)).toBeNull()
  })

  it("serializes a local calendar date without a time component", () => {
    process.env.TZ = "America/New_York"
    expect(localDateToDateOnly(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05")
    expect(localDateToDateOnly(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31")
  })
})

describe("legacy date-only normalization", () => {
  it("normalizes a legacy date-only value to local midnight as a UTC instant", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeLegacyDateValue("2026-01-05")).toBe(
      "2026-01-04T17:00:00.000Z"
    )
  })

  it("normalizes an existing instant without changing the moment", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeLegacyDateValue("2026-01-05T12:00:00.000Z")).toBe(
      "2026-01-05T12:00:00.000Z"
    )
  })

  it("returns null for empty and invalid values", () => {
    expect(normalizeLegacyDateValue(null)).toBeNull()
    expect(normalizeLegacyDateValue(undefined)).toBeNull()
    expect(normalizeLegacyDateValue("")).toBeNull()
    expect(normalizeLegacyDateValue("nope")).toBeNull()
  })
})

describe("local day boundaries", () => {
  it("converts a local day to UTC boundaries in a positive-offset timezone", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(localStartOfDayUtcInstant("2026-01-05")).toBe(
      "2026-01-04T17:00:00.000Z"
    )
    expect(localEndOfDayUtcInstant("2026-01-05")).toBe(
      "2026-01-05T16:59:59.999Z"
    )
  })

  it("accounts for the spring-forward DST transition", () => {
    process.env.TZ = "America/New_York"
    expect(localStartOfDayUtcInstant("2026-03-08")).toBe(
      "2026-03-08T05:00:00.000Z"
    )
    expect(localEndOfDayUtcInstant("2026-03-08")).toBe(
      "2026-03-09T03:59:59.999Z"
    )
  })

  it("accounts for the fall-back DST transition", () => {
    process.env.TZ = "America/New_York"
    expect(localStartOfDayUtcInstant("2026-11-01")).toBe(
      "2026-11-01T04:00:00.000Z"
    )
    expect(localEndOfDayUtcInstant("2026-11-01")).toBe(
      "2026-11-02T04:59:59.999Z"
    )
  })

})

describe("write instant serialization", () => {
  it("normalizes an offset date-time to a UTC instant", () => {
    expect(toUtcInstant("2026-06-01T09:30:00+07:00")).toBe(
      "2026-06-01T02:30:00.000Z"
    )
  })

  it("preserves an existing UTC instant", () => {
    expect(toUtcInstant("2026-06-01T02:30:00.000Z")).toBe(
      "2026-06-01T02:30:00.000Z"
    )
  })

  it("rejects date-only values so new writes cannot create legacy records", () => {
    expect(toUtcInstant("2026-01-05")).toBeNull()
  })

  it("returns null for empty and invalid values", () => {
    expect(toUtcInstant(null)).toBeNull()
    expect(toUtcInstant(undefined)).toBeNull()
    expect(toUtcInstant("")).toBeNull()
    expect(toUtcInstant("nope")).toBeNull()
  })
})

describe("locale-aware formatting", () => {
  it("formats a date for English and Vietnamese", () => {
    const value = "2026-01-05T12:00:00.000Z"
    expect(formatDate(value, "en")).toBe("Jan 5, 2026")
    expect(formatDate(value, "vi")).toBe("5 thg 1, 2026")
  })

  it("formats a time for English and Vietnamese", () => {
    const value = "2026-01-05T12:00:00.000Z"
    expect(formatTime(value, "en")).toBe("12:00 PM")
    expect(formatTime(value, "vi")).toBe("12:00")
  })

  it("formats a date and time for English and Vietnamese", () => {
    const value = "2026-01-05T12:00:00.000Z"
    expect(formatDateTime(value, "en")).toBe("Jan 5, 2026, 12:00 PM")
    expect(formatDateTime(value, "vi")).toBe("12:00 5 thg 1, 2026")
  })

  it("formats a date range for English and Vietnamese", () => {
    const from = "2026-01-05T00:00:00.000Z"
    const to = "2026-01-10T00:00:00.000Z"
    expect(normalizeSpaces(formatDateRange(from, to, "en"))).toBe(
      "Jan 5 – 10, 2026"
    )
    expect(normalizeSpaces(formatDateRange(from, to, "vi"))).toBe(
      "5 – 10 thg 1, 2026"
    )
  })

  it("formats a partial range as the bound that exists", () => {
    const from = "2026-01-05T00:00:00.000Z"
    expect(formatDateRange(from, null, "en")).toBe("Jan 5, 2026")
    expect(formatDateRange(null, from, "en")).toBe("Jan 5, 2026")
    expect(formatDateRange(null, null, "en")).toBe("")
  })

  it("treats date-only values as local calendar days", () => {
    process.env.TZ = "America/New_York"
    expect(formatDate("2026-01-05", "en")).toBe("Jan 5, 2026")
  })
})
