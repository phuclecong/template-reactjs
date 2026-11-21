import { describe, expect, it } from "vitest"
import {
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/ui/lib/date"
import { createTableUrlAdapter } from "../src/hooks/url-table-state"

const STATUSES = ["todo", "in-progress", "done", "blocked"] as const

const adapter = createTableUrlAdapter({
  defaultSortField: "title",
  defaultSortOrder: "asc",
  defaultPageSize: 30,
  sortableFields: ["title", "status", "dueDate"],
  ownedParams: [
    "q",
    "status",
    "priority",
    "assignee",
    "dueFrom",
    "dueTo",
    "sort",
    "order",
    "page",
    "pageSize",
  ],
  legacyParamPattern: /^(currentPage|(filters|sorters)\[.*\])$/,
  filters: [
    { kind: "text", param: "q", field: "q" },
    {
      kind: "enumMulti",
      param: "status",
      field: "status",
      values: STATUSES,
    },
    { kind: "enumMulti", param: "assignee", field: "assigneeId" },
    {
      kind: "dateRange",
      fromParam: "dueFrom",
      toParam: "dueTo",
      field: "dueDate",
    },
  ],
})

function parse(query: string) {
  return adapter.parse(new URLSearchParams(query))
}

describe("table URL adapter parse", () => {
  it("returns the table defaults for an empty query string", () => {
    expect(parse("")).toEqual({
      filters: [],
      sorters: [{ field: "title", order: "asc" }],
      currentPage: 1,
      pageSize: 30,
    })
  })

  it("reads text and multi-value filters", () => {
    const state = parse("q=release&status=todo&assignee=usr_admin,unassigned")
    expect(state.filters).toEqual([
      { field: "q", operator: "contains", value: "release" },
      { field: "status", operator: "eq", value: "todo" },
      {
        field: "assigneeId",
        operator: "in",
        value: ["usr_admin", "unassigned"],
      },
    ])
  })

  it("drops unknown enum values and empty segments", () => {
    const state = parse("status=unknown,todo,,done")
    expect(state.filters).toEqual([
      { field: "status", operator: "in", value: ["todo", "done"] },
    ])
  })

  it("converts date bounds to inclusive UTC instants", () => {
    const state = parse("dueFrom=2026-01-02&dueTo=2026-01-03")
    expect(state.filters).toEqual([
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

  it("drops invalid dates instead of throwing", () => {
    const state = parse("dueFrom=2026-02-31")
    expect(state.filters).toEqual([])
  })

  it("falls back on unknown sort, order, page, and page size", () => {
    const state = parse("sort=assignee&order=sideways&page=0&pageSize=junk")
    expect(state.sorters).toEqual([{ field: "title", order: "asc" }])
    expect(state.currentPage).toBe(1)
    expect(state.pageSize).toBe(30)
  })
})

describe("table URL adapter build", () => {
  it("omits defaults and preserves parameters the table does not own", () => {
    const params = adapter.build(
      {
        filters: [],
        sorters: [{ field: "title", order: "asc" }],
        currentPage: 1,
        pageSize: 30,
      },
      new URLSearchParams("tab=open&page=2&q=stale&currentPage=3")
    )
    // `page` and `q` are owned, so the stale values are replaced by defaults;
    // the legacy bracket key and unrelated parameter are not.
    expect(params.toString()).toBe("tab=open")
  })

  it("drops legacy bracket keys on write", () => {
    const params = adapter.build(
      {
        filters: [],
        sorters: [{ field: "title", order: "asc" }],
        currentPage: 1,
        pageSize: 30,
      },
      new URLSearchParams(
        "filters%5B0%5D%5Bfield%5D=status&sorters%5B0%5D%5Bfield%5D=title"
      )
    )
    expect(params.toString()).toBe("")
  })

  it("writes sorting, pagination, and filters", () => {
    const params = adapter.build(
      {
        filters: [
          { field: "q", operator: "contains", value: "release" },
          { field: "status", operator: "in", value: ["todo", "done"] },
          { field: "assigneeId", operator: "eq", value: "unassigned" },
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
        ],
        sorters: [{ field: "dueDate", order: "desc" }],
        currentPage: 2,
        pageSize: 10,
      },
      new URLSearchParams()
    )
    expect(params.toString()).toBe(
      "q=release&status=todo%2Cdone&assignee=unassigned&dueFrom=2026-01-02&dueTo=2026-01-03&sort=dueDate&order=desc&page=2&pageSize=10"
    )
  })

  it("writes only the direction when the default field sorts differently", () => {
    const params = adapter.build(
      {
        filters: [],
        sorters: [{ field: "title", order: "desc" }],
        currentPage: 1,
        pageSize: 30,
      },
      new URLSearchParams()
    )
    expect(params.toString()).toBe("order=desc")
  })

  it("round-trips a canonical query string", () => {
    const query =
      "q=release&status=in-progress&assignee=usr_admin%2Cunassigned&dueFrom=2026-01-02&dueTo=2026-01-03&sort=status&order=desc&page=2&pageSize=10"
    const rebuilt = adapter.build(parse(query), new URLSearchParams())
    expect(rebuilt.toString()).toBe(query)
  })
})
