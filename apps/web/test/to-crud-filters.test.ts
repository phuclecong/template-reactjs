import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  joinFilterValues,
  parseFilterValues,
  toCrudFilters,
} from "@/features/tasks/utils"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "Asia/Ho_Chi_Minh"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

const emptyFilters = {
  status: "",
  priority: "",
  assignee: "",
  dueFrom: "",
  dueTo: "",
}

describe("parseFilterValues", () => {
  it("splits a comma-joined value into trimmed, non-empty values", () => {
    expect(parseFilterValues("todo, in-progress ,, done")).toEqual([
      "todo",
      "in-progress",
      "done",
    ])
  })

  it("returns an empty list for an empty value", () => {
    expect(parseFilterValues("")).toEqual([])
    expect(parseFilterValues("  ,  ")).toEqual([])
  })
})

describe("joinFilterValues", () => {
  it("joins values with a comma", () => {
    expect(joinFilterValues(["todo", "in-progress"])).toBe("todo,in-progress")
  })

  it("joins an empty list to an empty string", () => {
    expect(joinFilterValues([])).toBe("")
  })
})

describe("toCrudFilters", () => {
  it("returns an empty list when there is no query or filter", () => {
    expect(toCrudFilters("", emptyFilters)).toEqual([])
  })

  it("maps the search query to a contains filter", () => {
    expect(toCrudFilters("fix", emptyFilters)).toEqual([
      { field: "q", operator: "contains", value: "fix" },
    ])
  })

  it("maps status and priority to eq filters", () => {
    expect(
      toCrudFilters("", { ...emptyFilters, status: "done", priority: "high" })
    ).toEqual([
      { field: "status", operator: "eq", value: "done" },
      { field: "priority", operator: "eq", value: "high" },
    ])
  })

  it("maps several statuses to an in filter", () => {
    expect(
      toCrudFilters("", {
        ...emptyFilters,
        status: "todo, in-progress,done",
      })
    ).toEqual([
      {
        field: "status",
        operator: "in",
        value: ["todo", "in-progress", "done"],
      },
    ])
  })

  it("ignores empty segments in the status value", () => {
    expect(
      toCrudFilters("", { ...emptyFilters, status: "done, ," })
    ).toEqual([{ field: "status", operator: "eq", value: "done" }])
  })

  it("maps a single priority to an eq filter", () => {
    expect(
      toCrudFilters("", { ...emptyFilters, priority: "high" })
    ).toEqual([{ field: "priority", operator: "eq", value: "high" }])
  })

  it("maps several priorities to an in filter", () => {
    expect(
      toCrudFilters("", { ...emptyFilters, priority: "low, high" })
    ).toEqual([{ field: "priority", operator: "in", value: ["low", "high"] }])
  })

  it("maps several assignees to an in filter, keeping the unassigned sentinel", () => {
    expect(
      toCrudFilters("", {
        ...emptyFilters,
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

  it("maps assignee to assigneeId and due date bounds to UTC instants", () => {
    // Asia/Ho_Chi_Minh is UTC+7, so the local day boundaries shift into the
    // previous/next UTC day. A From bound is the start of the local day and a
    // To bound is the end of the local day.
    expect(
      toCrudFilters("", {
        ...emptyFilters,
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

  it("supports a lower bound only", () => {
    expect(
      toCrudFilters("", { ...emptyFilters, dueFrom: "2026-01-01" })
    ).toEqual([
      {
        field: "dueDate",
        operator: "gte",
        value: "2025-12-31T17:00:00.000Z",
      },
    ])
  })

  it("supports an upper bound only", () => {
    expect(toCrudFilters("", { ...emptyFilters, dueTo: "2026-01-31" })).toEqual([
      {
        field: "dueDate",
        operator: "lte",
        value: "2026-01-31T16:59:59.999Z",
      },
    ])
  })

  it("skips empty filter values", () => {
    expect(
      toCrudFilters("", { ...emptyFilters, priority: "", dueFrom: "" })
    ).toEqual([])
  })

  it("skips invalid date-only filter values", () => {
    expect(
      toCrudFilters("", {
        ...emptyFilters,
        dueFrom: "not-a-date",
        dueTo: "2026-02-31",
      })
    ).toEqual([])
  })
})
