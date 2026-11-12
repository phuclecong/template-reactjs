import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { dueDateToFormValue, formValueToDueDate } from "@/features/tasks/utils"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "Asia/Ho_Chi_Minh"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

describe("task Due date form boundary", () => {
  it("keeps a stored instant as the form value", () => {
    expect(dueDateToFormValue("2026-01-04T17:00:00.000Z")).toBe(
      "2026-01-04T17:00:00.000Z"
    )
  })

  it("normalizes a legacy date-only value to local midnight", () => {
    expect(dueDateToFormValue("2026-01-05")).toBe("2026-01-04T17:00:00.000Z")
  })

  it("returns an empty form value when there is no Due date", () => {
    expect(dueDateToFormValue(null)).toBe("")
    expect(dueDateToFormValue(undefined)).toBe("")
  })

  it("sends the selected instant unchanged", () => {
    expect(formValueToDueDate("2026-01-05T12:30:00.000Z")).toBe(
      "2026-01-05T12:30:00.000Z"
    )
  })

  it("normalizes a date-only input to local midnight", () => {
    expect(formValueToDueDate("2026-01-05")).toBe("2026-01-04T17:00:00.000Z")
  })

  it("sends null when the form value is empty", () => {
    expect(formValueToDueDate("")).toBeNull()
  })
})
