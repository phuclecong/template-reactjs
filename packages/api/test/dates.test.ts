import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  compareDueDates,
  dueDateInstant,
  isValidDueDateInput,
  normalizeDueDate,
  normalizeDueDateBound,
} from "../src/dates"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "UTC"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

describe("normalizeDueDate", () => {
  it("normalizes a legacy date-only value to local midnight as a UTC instant", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeDueDate("2026-01-05")).toBe("2026-01-04T17:00:00.000Z")
  })

  it("normalizes an instant with an offset to UTC", () => {
    expect(normalizeDueDate("2026-01-05T12:00:00+07:00")).toBe(
      "2026-01-05T05:00:00.000Z"
    )
  })

  it("preserves an existing UTC instant", () => {
    expect(normalizeDueDate("2026-01-05T12:00:00.000Z")).toBe(
      "2026-01-05T12:00:00.000Z"
    )
  })

  it("returns null for empty and invalid values", () => {
    expect(normalizeDueDate(null)).toBeNull()
    expect(normalizeDueDate(undefined)).toBeNull()
    expect(normalizeDueDate("")).toBeNull()
    expect(normalizeDueDate("not-a-date")).toBeNull()
  })
})

describe("normalizeDueDateBound", () => {
  it("normalizes a date-only lower bound to local start of day", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeDueDateBound("2026-01-05", "gte")).toBe(
      "2026-01-04T17:00:00.000Z"
    )
  })

  it("normalizes a date-only upper bound to local end of day", () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    expect(normalizeDueDateBound("2026-01-05", "lte")).toBe(
      "2026-01-05T16:59:59.999Z"
    )
  })

  it("keeps a datetime bound as an instant", () => {
    expect(normalizeDueDateBound("2026-01-05T12:00:00.000Z", "lte")).toBe(
      "2026-01-05T12:00:00.000Z"
    )
  })

  it("returns null for empty and invalid bounds", () => {
    expect(normalizeDueDateBound(null, "gte")).toBeNull()
    expect(normalizeDueDateBound("not-a-date", "lte")).toBeNull()
  })
})

describe("due date comparison", () => {
  it("compares legacy date-only values as local-midnight instants", () => {
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

describe("isValidDueDateInput", () => {
  it("accepts date-only and datetime strings", () => {
    expect(isValidDueDateInput("2026-01-05")).toBe(true)
    expect(isValidDueDateInput("2026-01-05T12:00:00.000Z")).toBe(true)
    expect(isValidDueDateInput("2026-01-05T12:00:00+07:00")).toBe(true)
  })

  it("rejects invalid strings", () => {
    expect(isValidDueDateInput("")).toBe(false)
    expect(isValidDueDateInput("nope")).toBe(false)
    expect(isValidDueDateInput("2026-02-31")).toBe(false)
  })
})
