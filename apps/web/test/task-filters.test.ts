import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  clearTaskFilter,
  EMPTY_TASK_FILTERS,
  taskFilterChips,
  taskFiltersFromCrud,
  taskFiltersToCrud,
} from "@/features/tasks/utils/filters"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "Asia/Ho_Chi_Minh"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

describe("EMPTY_TASK_FILTERS", () => {
  it("has every task filter key set to an empty string", () => {
    expect(EMPTY_TASK_FILTERS).toEqual({
      q: "",
      status: "",
      priority: "",
      assignee: "",
      dueFrom: "",
      dueTo: "",
    })
  })
})

describe("taskFiltersToCrud", () => {
  it("returns an empty list when there is no query or filter", () => {
    expect(taskFiltersToCrud(EMPTY_TASK_FILTERS)).toEqual([])
  })

  it("maps the search term to a contains filter", () => {
    expect(taskFiltersToCrud({ ...EMPTY_TASK_FILTERS, q: "fix" })).toEqual([
      { field: "q", operator: "contains", value: "fix" },
    ])
  })

  it("maps status and priority to eq filters", () => {
    expect(
      taskFiltersToCrud({
        ...EMPTY_TASK_FILTERS,
        status: "done",
        priority: "high",
      })
    ).toEqual([
      { field: "status", operator: "eq", value: "done" },
      { field: "priority", operator: "eq", value: "high" },
    ])
  })

  it("maps several statuses to an in filter and ignores empty segments", () => {
    expect(
      taskFiltersToCrud({
        ...EMPTY_TASK_FILTERS,
        status: "todo, in-progress,done, ,",
      })
    ).toEqual([
      {
        field: "status",
        operator: "in",
        value: ["todo", "in-progress", "done"],
      },
    ])
  })

  it("maps several assignees to an in filter, keeping the sentinel", () => {
    expect(
      taskFiltersToCrud({
        ...EMPTY_TASK_FILTERS,
        assignee: "usr_admin,unassigned",
      })
    ).toEqual([
      {
        field: "assigneeId",
        operator: "in",
        value: ["usr_admin", "unassigned"],
      },
    ])
  })

  it("maps due date bounds to the local start and end of each day", () => {
    // Asia/Ho_Chi_Minh is UTC+7, so the local day boundaries shift into the
    // previous/next UTC day.
    expect(
      taskFiltersToCrud({
        ...EMPTY_TASK_FILTERS,
        assignee: "usr_1",
        dueFrom: "2026-01-01",
        dueTo: "2026-01-31",
      })
    ).toEqual([
      { field: "assigneeId", operator: "eq", value: "usr_1" },
      {
        field: "dueDate",
        operator: "gte",
        value: "2025-12-31T17:00:00.000Z",
      },
      {
        field: "dueDate",
        operator: "lte",
        value: "2026-01-31T16:59:59.999Z",
      },
    ])
  })

  it("supports one due-date bound at a time", () => {
    expect(
      taskFiltersToCrud({ ...EMPTY_TASK_FILTERS, dueFrom: "2026-01-01" })
    ).toEqual([
      {
        field: "dueDate",
        operator: "gte",
        value: "2025-12-31T17:00:00.000Z",
      },
    ])
    expect(
      taskFiltersToCrud({ ...EMPTY_TASK_FILTERS, dueTo: "2026-01-31" })
    ).toEqual([
      {
        field: "dueDate",
        operator: "lte",
        value: "2026-01-31T16:59:59.999Z",
      },
    ])
  })

  it("skips invalid date-only filter values", () => {
    expect(
      taskFiltersToCrud({
        ...EMPTY_TASK_FILTERS,
        dueFrom: "not-a-date",
        dueTo: "2026-02-31",
      })
    ).toEqual([])
  })
})

describe("taskFiltersFromCrud", () => {
  it("round-trips the URL values", () => {
    const values = {
      q: "release",
      status: "todo,in-progress",
      priority: "low,high",
      assignee: "usr_admin,unassigned",
      dueFrom: "2026-01-01",
      dueTo: "2026-01-31",
    }
    expect(taskFiltersFromCrud(taskFiltersToCrud(values))).toEqual(values)
  })

  it("drops enum values the contract does not know", () => {
    expect(
      taskFiltersFromCrud([
        { field: "status", operator: "in", value: ["todo", "unknown"] },
      ]).status
    ).toBe("todo")
  })

  it("reads a single eq value as a comma-joined list", () => {
    expect(
      taskFiltersFromCrud([
        { field: "priority", operator: "eq", value: "high" },
      ]).priority
    ).toBe("high")
  })

  it("returns empty values for an empty filter list", () => {
    expect(taskFiltersFromCrud([])).toEqual(EMPTY_TASK_FILTERS)
  })
})

describe("clearTaskFilter", () => {
  it("clears both bounds of the due-date filter", () => {
    expect(
      clearTaskFilter(
        { ...EMPTY_TASK_FILTERS, dueFrom: "2026-01-01", dueTo: "2026-01-31" },
        "dueDate"
      )
    ).toEqual(EMPTY_TASK_FILTERS)
  })

  it("clears one logical filter and leaves the others", () => {
    expect(
      clearTaskFilter({ ...EMPTY_TASK_FILTERS, q: "fix", status: "done" }, "q")
    ).toEqual({ ...EMPTY_TASK_FILTERS, status: "done" })
  })
})

describe("taskFilterChips", () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    String(options?.value ?? options?.date ?? key)
  const statusOptions = [
    { value: "todo", label: "To do" },
    { value: "done", label: "Done" },
  ]
  const priorityOptions = [{ value: "high", label: "High" }]
  const assigneeOptions = [
    { value: "usr_admin", label: "Ada Admin" },
    { value: "unassigned", label: "Unassigned" },
  ]

  it("derives chips in descriptor order using option labels", () => {
    expect(
      taskFilterChips(
        {
          ...EMPTY_TASK_FILTERS,
          q: "release",
          status: "todo,done",
          assignee: "usr_admin,unassigned",
          dueFrom: "2026-01-01",
        },
        { t, statusOptions, priorityOptions, assigneeOptions }
      )
    ).toEqual([
      { key: "q", label: "release" },
      { key: "status", label: "To do, Done" },
      { key: "assignee", label: "Ada Admin, Unassigned" },
      { key: "dueDate", label: "2026-01-01" },
    ])
  })
})
