import { describe, expect, it } from "vitest"
import { DEFAULT_PAGE_SIZE } from "@workspace/shared-lib/hooks/table-defaults"

import {
  buildUsersSearchParams,
  parseUsersUrlState,
  userFiltersFromCrud,
  userFiltersToCrud,
  USERS_DEFAULT_SORT_FIELD,
  USERS_DEFAULT_SORT_ORDER,
} from "@/features/users/utils/url-state"

const params = (init = "") => new URLSearchParams(init)

const defaultSorters = [
  { field: USERS_DEFAULT_SORT_FIELD, order: USERS_DEFAULT_SORT_ORDER },
]

describe("parseUsersUrlState", () => {
  it("defaults an empty query string to name ascending", () => {
    expect(parseUsersUrlState(params())).toEqual({
      filters: [],
      sorters: defaultSorters,
      currentPage: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it("maps the flat q and roleId keys to CrudFilters", () => {
    expect(
      parseUsersUrlState(params("q=ada&roleId=rol_admin")).filters
    ).toEqual([
      { field: "q", operator: "contains", value: "ada" },
      { field: "roleId", operator: "eq", value: "rol_admin" },
    ])
  })

  it("reads sort, order, page, and pageSize", () => {
    const state = parseUsersUrlState(
      params("sort=email&order=desc&page=2&pageSize=50")
    )

    expect(state.sorters).toEqual([{ field: "email", order: "desc" }])
    expect(state.currentPage).toBe(2)
    expect(state.pageSize).toBe(50)
  })

  it("falls back for unknown sort fields and unparseable paging", () => {
    const state = parseUsersUrlState(
      params("sort=password&order=sideways&page=0&pageSize=-5")
    )

    expect(state.sorters).toEqual(defaultSorters)
    expect(state.currentPage).toBe(1)
    expect(state.pageSize).toBe(DEFAULT_PAGE_SIZE)
  })
})

describe("userFilters conversion", () => {
  it("round-trips the bar's values through the declared descriptor keys", () => {
    const values = { q: "ada", roleId: "rol_member" }

    expect(userFiltersToCrud(values)).toEqual([
      { field: "q", operator: "contains", value: "ada" },
      { field: "roleId", operator: "eq", value: "rol_member" },
    ])
    expect(userFiltersFromCrud(userFiltersToCrud(values))).toEqual(values)
  })

  it("omits empty values", () => {
    expect(userFiltersToCrud({ q: "", roleId: "" })).toEqual([])
    expect(userFiltersFromCrud([])).toEqual({ q: "", roleId: "" })
  })
})

describe("buildUsersSearchParams", () => {
  it("omits defaults from the query string", () => {
    const state = parseUsersUrlState(params())

    expect(buildUsersSearchParams(state, params()).toString()).toBe("")
  })

  it("writes q, roleId, sort, order, page, and pageSize as flat keys", () => {
    const state = parseUsersUrlState(
      params("q=ada&roleId=rol_admin&sort=email&order=desc&page=2&pageSize=50")
    )

    expect(buildUsersSearchParams(state, params()).toString()).toBe(
      "q=ada&roleId=rol_admin&sort=email&order=desc&page=2&pageSize=50"
    )
  })

  it("preserves parameters the table does not own", () => {
    const state = parseUsersUrlState(params("q=ada"))
    const current = params("tab=active&filter=open")

    expect(buildUsersSearchParams(state, current).toString()).toBe(
      "tab=active&filter=open&q=ada"
    )
  })

  it("encodes reserved characters in the search term", () => {
    const state = parseUsersUrlState(params())
    state.filters = [{ field: "q", operator: "contains", value: "a&b=c#d% e" }]

    const built = buildUsersSearchParams(state, params())

    expect(built.get("q")).toBe("a&b=c#d% e")
    expect(built.toString()).toBe("q=a%26b%3Dc%23d%25+e")
  })

  it("round-trips the parsed state", () => {
    const parsed = parseUsersUrlState(
      params("q=a%26b&roleId=rol_admin&sort=name&order=desc&page=3&pageSize=50")
    )

    expect(
      parseUsersUrlState(buildUsersSearchParams(parsed, params()))
    ).toEqual(parsed)
  })
})
