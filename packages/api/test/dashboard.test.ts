import { describe, expect, it } from "vitest"

import { summarizeTasks } from "../src/dashboard"
import type { TaskRecord } from "../src/schemas"

const NOW = new Date("2026-06-15T12:00:00.000Z")

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "tsk_1",
    title: "Task",
    description: null,
    status: "todo",
    priority: null,
    assigneeId: null,
    dueDate: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("summarizeTasks", () => {
  it("zero-fills every category when there are no Tasks", () => {
    const summary = summarizeTasks([], [], NOW)

    expect(summary.totals).toEqual({
      total: 0,
      open: 0,
      overdue: 0,
      completionRate: 0,
    })
    expect(summary.byStatus).toEqual([
      { status: "todo", count: 0 },
      { status: "in-progress", count: 0 },
      { status: "done", count: 0 },
      { status: "blocked", count: 0 },
    ])
    expect(summary.byPriority).toEqual([
      { priority: "low", count: 0 },
      { priority: "medium", count: 0 },
      { priority: "high", count: 0 },
      { priority: "unassigned", count: 0 },
    ])
    expect(summary.byAssignee).toEqual([])
    expect(summary.generatedAt).toBe(NOW.toISOString())
  })

  it("counts open, overdue, and completion", () => {
    const summary = summarizeTasks(
      [
        task({ id: "a", status: "todo", dueDate: "2026-06-01T00:00:00.000Z" }),
        task({
          id: "b",
          status: "in-progress",
          dueDate: "2026-07-01T00:00:00.000Z",
        }),
        task({ id: "c", status: "blocked", dueDate: null }),
        task({ id: "d", status: "done", dueDate: "2026-06-01T00:00:00.000Z" }),
      ],
      [],
      NOW
    )

    expect(summary.totals).toEqual({
      total: 4,
      open: 3,
      overdue: 1,
      completionRate: 0.25,
    })
    expect(summary.byStatus.find((entry) => entry.status === "done")).toEqual({
      status: "done",
      count: 1,
    })
  })

  it("never counts a Task with no due date as overdue", () => {
    const summary = summarizeTasks(
      [task({ status: "todo", dueDate: null })],
      [],
      NOW
    )

    expect(summary.totals.overdue).toBe(0)
  })

  it("honours legacy date-only due dates", () => {
    const summary = summarizeTasks(
      [task({ status: "todo", dueDate: "2026-06-01" })],
      [],
      NOW
    )

    expect(summary.totals.overdue).toBe(1)
  })

  it("groups by priority and counts missing priority as unassigned", () => {
    const summary = summarizeTasks(
      [
        task({ id: "a", priority: "high" }),
        task({ id: "b", priority: "high" }),
        task({ id: "c", priority: null }),
      ],
      [],
      NOW
    )

    expect(summary.byPriority).toEqual([
      { priority: "low", count: 0 },
      { priority: "medium", count: 0 },
      { priority: "high", count: 2 },
      { priority: "unassigned", count: 1 },
    ])
  })

  it("returns the five busiest assignees, then Unassigned", () => {
    const users = [
      { id: "u1", name: "Ada" },
      { id: "u2", name: "Bea" },
      { id: "u3", name: "Cal" },
      { id: "u4", name: "Dee" },
      { id: "u5", name: "Eve" },
      { id: "u6", name: "Fay" },
    ]
    const tasks = [
      ...Array.from({ length: 6 }, (_, i) =>
        task({ id: `u6-${i}`, assigneeId: "u6" })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        task({ id: `u1-${i}`, assigneeId: "u1" })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        task({ id: `u2-${i}`, assigneeId: "u2" })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `u3-${i}`, assigneeId: "u3" })
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        task({ id: `u4-${i}`, assigneeId: "u4" })
      ),
      ...Array.from({ length: 1 }, (_, i) =>
        task({ id: `u5-${i}`, assigneeId: "u5" })
      ),
      task({ id: "none-1", assigneeId: null }),
      task({ id: "none-2", assigneeId: null }),
    ]

    const summary = summarizeTasks(tasks, users, NOW)

    expect(summary.byAssignee).toEqual([
      { assigneeId: "u6", name: "Fay", count: 6 },
      { assigneeId: "u1", name: "Ada", count: 5 },
      { assigneeId: "u2", name: "Bea", count: 4 },
      { assigneeId: "u3", name: "Cal", count: 3 },
      { assigneeId: "u4", name: "Dee", count: 2 },
      { assigneeId: null, name: "", count: 2 },
    ])
  })

  it("breaks assignee ties by name", () => {
    const summary = summarizeTasks(
      [
        task({ id: "a", assigneeId: "u2" }),
        task({ id: "b", assigneeId: "u1" }),
      ],
      [
        { id: "u1", name: "Zed" },
        { id: "u2", name: "Amy" },
      ],
      NOW
    )

    expect(summary.byAssignee.map((entry) => entry.name)).toEqual([
      "Amy",
      "Zed",
    ])
  })

  it("falls back to the id when an assignee is missing from the store", () => {
    const summary = summarizeTasks(
      [task({ assigneeId: "deleted-user" })],
      [],
      NOW
    )

    expect(summary.byAssignee).toEqual([
      { assigneeId: "deleted-user", name: "deleted-user", count: 1 },
    ])
  })
})
