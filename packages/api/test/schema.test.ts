import { describe, expect, it } from "vitest"

import { taskRecordSchema } from "../src/collections"

function record(dueDate: string | null | undefined) {
  return {
    id: "tsk_schema",
    title: "Schema fixture",
    status: "todo" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    dueDate,
  }
}

describe("taskRecordSchema dueDate", () => {
  it("accepts an ISO 8601 UTC instant", () => {
    expect(
      taskRecordSchema.safeParse(record("2026-01-05T00:00:00.000Z")).success
    ).toBe(true)
  })

  it("accepts a legacy date-only value", () => {
    expect(taskRecordSchema.safeParse(record("2026-01-05")).success).toBe(true)
  })

  it("accepts null and an omitted value", () => {
    expect(taskRecordSchema.safeParse(record(null)).success).toBe(true)
    expect(taskRecordSchema.safeParse(record(undefined)).success).toBe(true)
  })

  it("rejects an arbitrary string", () => {
    expect(taskRecordSchema.safeParse(record("not-a-date")).success).toBe(false)
  })
})
