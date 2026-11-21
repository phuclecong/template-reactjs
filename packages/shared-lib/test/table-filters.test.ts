import { describe, expect, it } from "vitest"
import {
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/ui/lib/date"

import {
  clear,
  dateRangeText,
  deriveChips,
  filterValueLabels,
  fromCrud,
  toCrud,
  type TableFilterDescriptor,
} from "../src/utils/table-filters"
import type { TableUrlFilterDescriptor } from "../src/utils/table-url-descriptors"

const STATUSES = ["todo", "in-progress", "done"] as const

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
]

const statusLabels = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(
      (part) =>
        STATUS_OPTIONS.find((option) => option.value === part)?.label ?? part
    )
    .join(", ")

type Values = {
  q: string
  status: string
  assignee: string
  dueFrom: string
  dueTo: string
}

type Key = "q" | "status" | "assignee" | "dueDate"

type ChipContext = { prefix: string }

const descriptors: readonly TableFilterDescriptor<Values, Key, ChipContext>[] =
  [
    {
      kind: "text",
      param: "q",
      field: "q",
      key: "q",
      chip: ({ q }, context) => `${context.prefix}search: ${q}`,
    },
    {
      kind: "enumMulti",
      param: "status",
      field: "status",
      values: STATUSES,
      key: "status",
      chip: ({ status }, context) =>
        `${context.prefix}status: ${statusLabels(status)}`,
    },
    {
      kind: "enumMulti",
      param: "assignee",
      field: "assigneeId",
      key: "assignee",
      chip: ({ assignee }, context) => `${context.prefix}assignee: ${assignee}`,
    },
    {
      kind: "dateRange",
      fromParam: "dueFrom",
      toParam: "dueTo",
      field: "dueDate",
      key: "dueDate",
      chip: ({ dueFrom, dueTo }, context) =>
        `${context.prefix}due: ${dueFrom} – ${dueTo}`,
    },
  ]

const EMPTY: Values = {
  q: "",
  status: "",
  assignee: "",
  dueFrom: "",
  dueTo: "",
}

const context: ChipContext = { prefix: "" }

describe("toCrud", () => {
  it("returns no filters for empty values", () => {
    expect(toCrud(descriptors, EMPTY)).toEqual([])
  })

  it("maps text to contains and a single enum to eq", () => {
    expect(toCrud(descriptors, { ...EMPTY, q: "fix", status: "done" })).toEqual(
      [
        { field: "q", operator: "contains", value: "fix" },
        { field: "status", operator: "eq", value: "done" },
      ]
    )
  })

  it("maps several enum values to an in filter in selection order", () => {
    expect(
      toCrud(descriptors, { ...EMPTY, status: "done, todo,in-progress" })
    ).toEqual([
      {
        field: "status",
        operator: "in",
        value: ["done", "todo", "in-progress"],
      },
    ])
  })

  it("maps the assignee bar key to the assigneeId field", () => {
    expect(
      toCrud(descriptors, { ...EMPTY, assignee: "usr_admin,unassigned" })
    ).toEqual([
      {
        field: "assigneeId",
        operator: "in",
        value: ["usr_admin", "unassigned"],
      },
    ])
  })

  it("maps date bounds to the start and end of each local day", () => {
    expect(
      toCrud(descriptors, {
        ...EMPTY,
        dueFrom: "2026-01-02",
        dueTo: "2026-01-03",
      })
    ).toEqual([
      {
        field: "dueDate",
        operator: "gte",
        value: localStartOfDayUtcInstant("2026-01-02"),
      },
      {
        field: "dueDate",
        operator: "lte",
        value: localEndOfDayUtcInstant("2026-01-03"),
      },
    ])
  })

  it("supports one date bound at a time", () => {
    expect(toCrud(descriptors, { ...EMPTY, dueTo: "2026-01-31" })).toEqual([
      {
        field: "dueDate",
        operator: "lte",
        value: localEndOfDayUtcInstant("2026-01-31"),
      },
    ])
  })

  it("drops invalid and overflowed date-only values instead of throwing", () => {
    expect(
      toCrud(descriptors, {
        ...EMPTY,
        dueFrom: "2026-02-31",
        dueTo: "not-a-date",
      })
    ).toEqual([])
  })
})

describe("fromCrud", () => {
  it("returns empty values for an empty filter list", () => {
    expect(fromCrud(descriptors, [])).toEqual(EMPTY)
  })

  it("reads text, enum, and assignee filters into bar values", () => {
    expect(
      fromCrud(descriptors, [
        { field: "q", operator: "contains", value: "release" },
        { field: "status", operator: "in", value: ["todo", "done"] },
        { field: "assigneeId", operator: "eq", value: "usr_admin" },
      ])
    ).toEqual({
      ...EMPTY,
      q: "release",
      status: "todo,done",
      assignee: "usr_admin",
    })
  })

  it("drops enum values the descriptor does not know", () => {
    expect(
      fromCrud(descriptors, [
        { field: "status", operator: "in", value: ["todo", "unknown"] },
      ]).status
    ).toBe("todo")
  })

  it("collapses stored date instants back to local days", () => {
    expect(
      fromCrud(descriptors, [
        {
          field: "dueDate",
          operator: "gte",
          value: localStartOfDayUtcInstant("2026-01-02"),
        },
        {
          field: "dueDate",
          operator: "lte",
          value: localEndOfDayUtcInstant("2026-01-03"),
        },
      ])
    ).toEqual({ ...EMPTY, dueFrom: "2026-01-02", dueTo: "2026-01-03" })
  })

  it("keeps legacy date-only values and ignores unparseable instants", () => {
    expect(
      fromCrud(descriptors, [
        { field: "dueDate", operator: "gte", value: "2026-01-02" },
        { field: "dueDate", operator: "lte", value: "not-a-date" },
      ])
    ).toEqual({ ...EMPTY, dueFrom: "2026-01-02" })
  })
})

describe("clear", () => {
  it("clears both bounds of a date range and leaves the other filters", () => {
    expect(
      clear(
        descriptors,
        {
          ...EMPTY,
          q: "fix",
          status: "done",
          dueFrom: "2026-01-01",
          dueTo: "2026-01-31",
        },
        "dueDate"
      )
    ).toEqual({ ...EMPTY, q: "fix", status: "done" })
  })

  it("clears a single-value filter by its logical key", () => {
    expect(
      clear(descriptors, { ...EMPTY, q: "fix", status: "done" }, "status")
    ).toEqual({ ...EMPTY, q: "fix" })
  })

  it("leaves the values untouched for an unknown key", () => {
    const values = { ...EMPTY, q: "fix" }
    expect(clear(descriptors, values, "assignee")).toEqual(values)
  })
})

describe("deriveChips", () => {
  it("derives active chips in descriptor order with feature copy", () => {
    expect(
      deriveChips(
        descriptors,
        {
          ...EMPTY,
          q: "fix",
          status: "todo,done",
          dueFrom: "2026-01-01",
        },
        context
      )
    ).toEqual([
      { key: "q", label: "search: fix" },
      { key: "status", label: "status: To do, Done" },
      { key: "dueDate", label: "due: 2026-01-01 – " },
    ])
  })

  it("returns no chips when every filter is empty", () => {
    expect(deriveChips(descriptors, EMPTY, context)).toEqual([])
  })
})

describe("filterValueLabels", () => {
  it("maps known comma-joined values to labels in order", () => {
    expect(filterValueLabels("todo, done", STATUS_OPTIONS)).toBe("To do, Done")
  })

  it("falls back to the raw value for unknown options and empty input", () => {
    expect(filterValueLabels("todo,unknown", STATUS_OPTIONS)).toBe(
      "To do, unknown"
    )
    expect(filterValueLabels("", STATUS_OPTIONS)).toBe("")
  })
})

describe("dateRangeText", () => {
  const copy = {
    range: (from: string, to: string) => `${from}–${to}`,
    from: (date: string) => `from ${date}`,
    until: (date: string) => `until ${date}`,
  }

  it("uses the range copy when both bounds are present", () => {
    expect(dateRangeText("2026-01-01", "2026-01-31", copy)).toBe(
      "2026-01-01–2026-01-31"
    )
  })

  it("uses the open-ended copy when one bound is missing", () => {
    expect(dateRangeText("2026-01-01", "", copy)).toBe("from 2026-01-01")
    expect(dateRangeText("", "2026-01-31", copy)).toBe("until 2026-01-31")
  })
})

describe("descriptor value-key link", () => {
  it("rejects a descriptor value key missing from the value shape", () => {
    type Values = { q: string }
    const valid: readonly TableUrlFilterDescriptor<Values>[] = [
      { kind: "text", param: "q", field: "q" },
    ]
    const invalid: readonly TableUrlFilterDescriptor<Values>[] = [
      // @ts-expect-error `query` is not a key of Values
      { kind: "text", param: "query", field: "q" },
    ]

    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(1)
  })
})
