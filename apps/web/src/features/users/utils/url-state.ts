import type { CrudFilter } from "@refinedev/core"
import {
  createTableUrlAdapter,
  type TableUrlFilterDescriptor,
  type TableUrlState,
} from "@workspace/shared-lib/hooks"
import { fromCrud, toCrud } from "@workspace/shared-lib/utils"

/** Default sort, matching the table's designed order. */
export const USERS_DEFAULT_SORT_FIELD = "name"
export const USERS_DEFAULT_SORT_ORDER = "asc"

/**
 * The scalar filter values the Users bar edits. The bar is deliberately not
 * chip-driven (see the 2026-11-21 review); these are translated to and from
 * Refine's `CrudFilter[]` inside the table.
 */
export type UserFilterValues = {
  q: string
  roleId: string
}

export const EMPTY_USER_FILTERS: UserFilterValues = { q: "", roleId: "" }

/**
 * The flat URL format for the Users table (ADR-0016). The keys match the
 * pre-Refine table so existing deep links keep working. These descriptors need
 * no chip metadata, so the URL adapter and the bar conversion share them.
 */
export const USER_FILTER_DESCRIPTORS: readonly TableUrlFilterDescriptor[] = [
  { kind: "text", param: "q", field: "q" },
  { kind: "enumMulti", param: "roleId", field: "roleId" },
]

const adapter = createTableUrlAdapter({
  defaultSortField: USERS_DEFAULT_SORT_FIELD,
  defaultSortOrder: USERS_DEFAULT_SORT_ORDER,
  sortableFields: ["name", "email", "roleId"],
  ownedParams: ["q", "roleId", "sort", "order", "page", "pageSize"],
  filters: USER_FILTER_DESCRIPTORS,
})

/** The table state the URL represents: the same shape Refine's `useTable` holds. */
export type UsersUrlState = TableUrlState

/** Parses flat query parameters into Refine table state. */
export function parseUsersUrlState(params: URLSearchParams): UsersUrlState {
  return adapter.parse(params)
}

/**
 * Writes table state as flat, URL-encoded query parameters, preserving any
 * parameters the table does not own.
 */
export function buildUsersSearchParams(
  state: UsersUrlState,
  current: URLSearchParams
): URLSearchParams {
  return adapter.build(state, current)
}

/** Reads Refine's `CrudFilter[]` into the bar's scalar values. */
export function userFiltersFromCrud(filters: CrudFilter[]): UserFilterValues {
  return fromCrud<UserFilterValues>(USER_FILTER_DESCRIPTORS, filters)
}

/** Converts the bar's scalar values to Refine filters. */
export function userFiltersToCrud(values: UserFilterValues): CrudFilter[] {
  return toCrud(USER_FILTER_DESCRIPTORS, values)
}
