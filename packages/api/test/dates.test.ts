import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  compareDueDates,
  dueDateInstant,
  normalizeDueDateInstant,
  normalizeStoredDueDate,
} from "../src/dates"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "UTC"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

describe("normalizeStoredDueDate", () => {
  it("normalizes a legacy date-only record to local midnight as a UTC instant", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeStoredDueDate("2026-01-05")).toBe(
      "2026-01-04T17:00:00.000Z"
    )
  })

  it("normalizes an instant with an offset to UTC", () => {
    expect(normalizeStoredDueDate("2026-01-05T12:00:00+07:00")).toBe(
      "2026-01-05T05:00:00.000Z"
    )
  })

  it("preserves an existing UTC instant", () => {
    expect(normalizeStoredDueDate("2026-01-05T12:00:00.000Z")).toBe(
      "2026-01-05T12:00:00.000Z"
    )
  })

  it("returns null for empty and invalid values", () => {
    expect(normalizeStoredDueDate(null)).toBeNull()
    expect(normalizeStoredDueDate(undefined)).toBeNull()
    expect(normalizeStoredDueDate("")).toBeNull()
    expect(normalizeStoredDueDate("not-a-date")).toBeNull()
  })
})

describe("normalizeDueDateInstant", () => {
  it("normalizes a date-time with an offset to a UTC instant", () => {
    expect(normalizeDueDateInstant("2026-06-01T09:30:00+07:00")).toBe(
      "2026-06-01T02:30:00.000Z"
    )
  })

  it("preserves an existing UTC instant", () => {
    expect(normalizeDueDateInstant("2026-06-01T02:30:00.000Z")).toBe(
      "2026-06-01T02:30:00.000Z"
    )
  })

  it("rejects date-only values so new writes cannot store them", () => {
    expect(normalizeDueDateInstant("2026-01-05")).toBeNull()
  })

  it("returns null for empty and invalid values", () => {
    expect(normalizeDueDateInstant(null)).toBeNull()
    expect(normalizeDueDateInstant(undefined)).toBeNull()
    expect(normalizeDueDateInstant("")).toBeNull()
    expect(normalizeDueDateInstant("not-a-date")).toBeNull()
  })
})

describe("due date comparison", () => {
  it("compares legacy date-only records as local-midnight instants", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    // Legacy 2026-01-05 is 2026-01-04T17:00Z; the other instant is later.
    expect(
      compareDueDates("2026-01-05", "2026-01-04T20:00:00.000Z")
    ).toBeLessThan(0)
    expect(dueDateInstant("2026-01-05")).toBe(
      Date.parse("2026-01-04T17:00:00.000Z")
    )
  })

  it("orders instants numerically rather than lexicographically", () => {
    expect(
      compareDueDates("2026-01-05T12:00:00.000Z", "2026-01-05T09:00:00.000Z")
    ).toBeGreaterThan(0)
  })

  it("sorts nulls last", () => {
    expect(compareDueDates(null, "2026-01-05T00:00:00.000Z")).toBeGreaterThan(0)
    expect(compareDueDates("2026-01-05T00:00:00.000Z", null)).toBeLessThan(0)
    expect(compareDueDates(null, null)).toBe(0)
  })
})
