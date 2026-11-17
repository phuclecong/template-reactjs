import { describe, expect, it } from "vitest"
import { DEFAULT_PAGE_SIZE } from "@workspace/shared-lib/hooks/table-defaults"

import {
  buildRolesSearchParams,
  parseRolesUrlState,
  ROLES_DEFAULT_SORT_FIELD,
  ROLES_DEFAULT_SORT_ORDER,
} from "@/features/roles/utils/url-state"

const params = (init = "") => new URLSearchParams(init)

const defaultSorters = [
  { field: ROLES_DEFAULT_SORT_FIELD, order: ROLES_DEFAULT_SORT_ORDER },
]

describe("parseRolesUrlState", () => {
  it("defaults an empty query string to the table's initial state", () => {
    expect(parseRolesUrlState(params())).toEqual({
      filters: [],
      sorters: defaultSorters,
      currentPage: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it("maps flat query parameters to CrudFilters", () => {
    const state = parseRolesUrlState(
      params(
        "title=admin&description=team&status=active,inactive" +
          "&createdAtFrom=2026-01-02&createdAtTo=2026-01-03" +
          "&updatedAtFrom=2026-02-01&updatedAtTo=2026-02-28"
      )
    )

    expect(state.filters).toEqual([
      { field: "title", operator: "contains", value: "admin" },
      { field: "description", operator: "contains", value: "team" },
      {
        field: "status",
        operator: "in",
        value: ["active", "inactive"],
      },
      { field: "createdAt", operator: "gte", value: expect.any(String) },
      { field: "createdAt", operator: "lte", value: expect.any(String) },
      { field: "updatedAt", operator: "gte", value: expect.any(String) },
      { field: "updatedAt", operator: "lte", value: expect.any(String) },
    ])
  })

  it("maps one status to an eq filter", () => {
    expect(parseRolesUrlState(params("status=inactive")).filters).toEqual([
      { field: "status", operator: "eq", value: "inactive" },
    ])
  })

  it("reads sort, page, and page size", () => {
    const state = parseRolesUrlState(
      params("sort=title&order=asc&page=2&pageSize=50")
    )

    expect(state.sorters).toEqual([{ field: "title", order: "asc" }])
    expect(state.currentPage).toBe(2)
    expect(state.pageSize).toBe(50)
  })

  it("drops unknown statuses, invalid dates, and unparseable paging/sort", () => {
    const state = parseRolesUrlState(
      params(
        "status=active,bogus&createdAtFrom=not-a-date&createdAtTo=2026-02-31" +
          "&sort=description&order=up&page=0&pageSize=-5"
      )
    )

    expect(state.filters).toEqual([
      { field: "status", operator: "eq", value: "active" },
    ])
    expect(state.sorters).toEqual(defaultSorters)
    expect(state.currentPage).toBe(1)
    expect(state.pageSize).toBe(DEFAULT_PAGE_SIZE)
  })
})

describe("buildRolesSearchParams", () => {
  it("omits defaults from the query string", () => {
    const state = parseRolesUrlState(params())

    expect(buildRolesSearchParams(state, params()).toString()).toBe("")
  })

  it("writes filters, sort, and paging as flat keys", () => {
    const state = parseRolesUrlState(
      params(
        "title=admin&status=active,inactive&createdAtFrom=2026-01-02" +
          "&createdAtTo=2026-01-03&sort=title&order=asc&page=2&pageSize=50"
      )
    )

    // URLSearchParams percent-encodes the comma that joins the status values.
    expect(buildRolesSearchParams(state, params()).toString()).toBe(
      "title=admin&status=active%2Cinactive&createdAtFrom=2026-01-02" +
        "&createdAtTo=2026-01-03&sort=title&order=asc&page=2&pageSize=50"
    )
  })

  it("writes only the direction when sorting the default field ascending", () => {
    const state = parseRolesUrlState(params("order=asc"))

    expect(buildRolesSearchParams(state, params()).toString()).toBe("order=asc")
  })

  it("preserves parameters the table does not own and strips legacy keys", () => {
    const state = parseRolesUrlState(params("title=admin&page=2"))
    const current = params(
      "foo=bar&currentPage=2&sorters[0][field]=title&filters[0][field]=title"
    )

    expect(buildRolesSearchParams(state, current).toString()).toBe(
      "foo=bar&title=admin&page=2"
    )
  })

  it("encodes reserved characters in text filters", () => {
    const state = {
      filters: [
        {
          field: "title" as const,
          operator: "contains" as const,
          value: "a&b=c#d% e",
        },
      ],
      sorters: defaultSorters,
      currentPage: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    }
    const built = buildRolesSearchParams(state, params())

    expect(built.get("title")).toBe("a&b=c#d% e")
    expect(built.toString()).toBe("title=a%26b%3Dc%23d%25+e")
  })

  it("round-trips the parsed state", () => {
    const parsed = parseRolesUrlState(
      params(
        "title=a%26b&status=active,inactive&createdAtFrom=2026-01-02" +
          "&createdAtTo=2026-01-03&sort=title&order=asc&page=3&pageSize=50"
      )
    )

    expect(
      parseRolesUrlState(buildRolesSearchParams(parsed, params()))
    ).toEqual(parsed)
  })
})
