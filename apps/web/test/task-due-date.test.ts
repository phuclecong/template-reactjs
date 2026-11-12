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
  it("shows a stored instant as the local calendar date", () => {
    expect(dueDateToFormValue("2026-01-04T17:00:00.000Z")).toBe("2026-01-05")
  })

  it("keeps a legacy date-only value on the same calendar day", () => {
    expect(dueDateToFormValue("2026-01-05")).toBe("2026-01-05")
  })

  it("returns an empty form value when there is no Due date", () => {
    expect(dueDateToFormValue(null)).toBe("")
    expect(dueDateToFormValue(undefined)).toBe("")
  })

  it("sends a local calendar date as local midnight in a UTC instant", () => {
    expect(formValueToDueDate("2026-01-05")).toBe("2026-01-04T17:00:00.000Z")
  })

  it("sends null when the form value is empty", () => {
    expect(formValueToDueDate("")).toBeNull()
  })
})
