import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  dateOnlyToLocalDate,
  isDateOnly,
  localDateToDateOnly,
  localDateTimeToUtcInstant,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
  normalizeInstantValue,
  normalizeStoredDateValue,
  parseLocalDateOnly,
} from "./index"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "UTC"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

describe("isDateOnly", () => {
  it("recognises a bare YYYY-MM-DD calendar date", () => {
    expect(isDateOnly("2026-01-05")).toBe(true)
  })

  it("rejects values that carry a time or use another format", () => {
    expect(isDateOnly("2026-01-05T00:00:00.000Z")).toBe(false)
    expect(isDateOnly("05/01/2026")).toBe(false)
    expect(isDateOnly("")).toBe(false)
    expect(isDateOnly(null)).toBe(false)
    expect(isDateOnly(undefined)).toBe(false)
  })
})

describe("parseLocalDateOnly", () => {
  it("parses a calendar date as local midnight", () => {
    const date = parseLocalDateOnly("2026-01-05")
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(0)
    expect(date?.getDate()).toBe(5)
    expect(date?.getHours()).toBe(0)
    expect(date?.getMinutes()).toBe(0)
  })

  it("rejects overflowed and non-date-only values", () => {
    expect(parseLocalDateOnly("2026-02-31")).toBeNull()
    expect(parseLocalDateOnly("2026-01-05T00:00:00.000Z")).toBeNull()
    expect(parseLocalDateOnly("")).toBeNull()
  })
})

describe("normalizeStoredDateValue", () => {
  it("normalizes a legacy date-only value to local midnight as a UTC instant", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeStoredDateValue("2026-01-05")).toBe(
      "2026-01-04T17:00:00.000Z"
    )
  })

  it("normalizes an instant with an offset to UTC", () => {
    expect(normalizeStoredDateValue("2026-01-05T12:00:00+07:00")).toBe(
      "2026-01-05T05:00:00.000Z"
    )
  })

  it("preserves an existing UTC instant", () => {
    expect(normalizeStoredDateValue("2026-01-05T12:00:00.000Z")).toBe(
      "2026-01-05T12:00:00.000Z"
    )
  })

  it("returns null for empty and invalid values", () => {
    expect(normalizeStoredDateValue(null)).toBeNull()
    expect(normalizeStoredDateValue(undefined)).toBeNull()
    expect(normalizeStoredDateValue("")).toBeNull()
    expect(normalizeStoredDateValue("not-a-date")).toBeNull()
  })

  it("returns null for an overflowed date-only value", () => {
    expect(normalizeStoredDateValue("2026-02-31")).toBeNull()
  })
})

describe("normalizeInstantValue", () => {
  it("normalizes a date-time with an offset to a UTC instant", () => {
    expect(normalizeInstantValue("2026-06-01T09:30:00+07:00")).toBe(
      "2026-06-01T02:30:00.000Z"
    )
  })

  it("preserves an existing UTC instant", () => {
    expect(normalizeInstantValue("2026-06-01T02:30:00.000Z")).toBe(
      "2026-06-01T02:30:00.000Z"
    )
  })

  it("rejects date-only values so new writes cannot store them", () => {
    expect(normalizeInstantValue("2026-01-05")).toBeNull()
  })

  it("returns null for empty and invalid values", () => {
    expect(normalizeInstantValue(null)).toBeNull()
    expect(normalizeInstantValue(undefined)).toBeNull()
    expect(normalizeInstantValue("")).toBeNull()
    expect(normalizeInstantValue("not-a-date")).toBeNull()
  })

  it("returns null for an overflowed date-only value", () => {
    expect(normalizeInstantValue("2026-02-31")).toBeNull()
  })
})

describe("date-only local conversion", () => {
  it("parses a date-only value as local midnight", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    const date = dateOnlyToLocalDate("2026-01-05")
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(0)
    expect(date?.getDate()).toBe(5)
    expect(date?.getHours()).toBe(0)
  })

  it("returns null for absent, non-date-only, and overflowed values", () => {
    expect(dateOnlyToLocalDate("2026-02-31")).toBeNull()
    expect(dateOnlyToLocalDate("2026-01-05T00:00:00.000Z")).toBeNull()
    expect(dateOnlyToLocalDate("")).toBeNull()
    expect(dateOnlyToLocalDate(null)).toBeNull()
    expect(dateOnlyToLocalDate(undefined)).toBeNull()
  })

  it("serializes a local calendar date without a time component", () => {
    process.env.TZ = "America/New_York"
    expect(localDateToDateOnly(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05")
    expect(localDateToDateOnly(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31")
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

  it("returns null for invalid, empty, and overflowed values", () => {
    expect(localStartOfDayUtcInstant("2026-02-31")).toBeNull()
    expect(localEndOfDayUtcInstant("2026-02-31")).toBeNull()
    expect(localStartOfDayUtcInstant("")).toBeNull()
    expect(localEndOfDayUtcInstant("not-a-date")).toBeNull()
    expect(localStartOfDayUtcInstant(new Date(Number.NaN))).toBeNull()
  })
})

describe("local datetime conversion", () => {
  it("builds a UTC instant from a local calendar day and wall-clock time", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(localDateTimeToUtcInstant(new Date(2026, 0, 20, 0, 0), 14, 30)).toBe(
      "2026-01-20T07:30:00.000Z"
    )
  })

  it("returns null for invalid, empty, and overflowed values", () => {
    expect(localDateTimeToUtcInstant("2026-02-31", 10, 0)).toBeNull()
    expect(localDateTimeToUtcInstant("", 10, 0)).toBeNull()
    expect(localDateTimeToUtcInstant(new Date(Number.NaN), 10, 0)).toBeNull()
  })
})
