import { describe, expect, it } from "vitest"

import { isDateOnly, parseLocalDateOnly } from "./index"

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
