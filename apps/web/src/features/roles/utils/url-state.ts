import { roleStatusSchema } from "@workspace/api/schemas"
import {
  createTableUrlAdapter,
  type TableUrlState,
} from "@workspace/shared-lib/hooks"

/** Default sort, matching the table's designed order. */
export const ROLES_DEFAULT_SORT_FIELD = "updatedAt"
export const ROLES_DEFAULT_SORT_ORDER = "desc"

/**
 * The flat URL format for the Roles table (ADR-0016). The encoding rules —
 * defaults omitted, unknown values dropped, date bounds converted to local
 * days, legacy bracket keys evicted — live in the shared adapter so the Tasks
 * table can reuse them.
 */
const adapter = createTableUrlAdapter({
  defaultSortField: ROLES_DEFAULT_SORT_FIELD,
  defaultSortOrder: ROLES_DEFAULT_SORT_ORDER,
  sortableFields: ["title", "status", "createdAt", "updatedAt"],
  ownedParams: [
    "title",
    "description",
    "status",
    "createdAtFrom",
    "createdAtTo",
    "updatedAtFrom",
    "updatedAtTo",
    "sort",
    "order",
    "page",
    "pageSize",
  ],
  // Keys written by Refine's old `syncWithLocation` encoding.
  legacyParamPattern: /^(currentPage|(filters|sorters)\[.*\])$/,
  filters: [
    { kind: "text", param: "title", field: "title" },
    { kind: "text", param: "description", field: "description" },
    {
      kind: "enumMulti",
      param: "status",
      field: "status",
      values: roleStatusSchema.options,
    },
    {
      kind: "dateRange",
      fromParam: "createdAtFrom",
      toParam: "createdAtTo",
      field: "createdAt",
    },
    {
      kind: "dateRange",
      fromParam: "updatedAtFrom",
      toParam: "updatedAtTo",
      field: "updatedAt",
    },
  ],
})

/** The table state the URL represents: the same shape Refine's `useTable` holds. */
export type RolesUrlState = TableUrlState

/** Parses flat query parameters into Refine table state. */
export function parseRolesUrlState(params: URLSearchParams): RolesUrlState {
  return adapter.parse(params)
}

/**
 * Writes table state as flat, URL-encoded query parameters, preserving any
 * parameters the table does not own.
 */
export function buildRolesSearchParams(
  state: RolesUrlState,
  current: URLSearchParams
): URLSearchParams {
  return adapter.build(state, current)
}
