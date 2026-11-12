import { describe, expect, it } from "vitest"

import { dueDateWriteSchema, taskRecordSchema } from "../src/collections"

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

  it("accepts a legacy date-only record during migration", () => {
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

describe("dueDateWriteSchema", () => {
  it("accepts a UTC instant", () => {
    expect(
      dueDateWriteSchema.safeParse("2026-06-01T02:30:00.000Z").success
    ).toBe(true)
  })

  it("accepts an instant with a numeric offset", () => {
    expect(
      dueDateWriteSchema.safeParse("2026-06-01T09:30:00+07:00").success
    ).toBe(true)
  })

  it("accepts null and an omitted value", () => {
    expect(dueDateWriteSchema.safeParse(null).success).toBe(true)
    expect(dueDateWriteSchema.safeParse(undefined).success).toBe(true)
  })

  it("rejects date-only values", () => {
    expect(dueDateWriteSchema.safeParse("2026-06-01").success).toBe(false)
  })

  it("rejects an invalid date-time", () => {
    expect(dueDateWriteSchema.safeParse("not-a-date").success).toBe(false)
    expect(dueDateWriteSchema.safeParse("2026-02-31T00:00:00.000Z").success).toBe(
      false
    )
  })
})
