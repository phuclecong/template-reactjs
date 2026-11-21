import { roleStatusSchema, type RoleStatus } from "@workspace/api/schemas"
import {
  createTableUrlAdapter,
  type EnumOption,
  type TableUrlState,
} from "@workspace/shared-lib/hooks"
import {
  filterValueLabels,
  type TableFilterDescriptor,
} from "@workspace/shared-lib/utils"

import type { RoleFilterKey, RoleFilterValues } from "./filters"

/** Default sort, matching the table's designed order. */
export const ROLES_DEFAULT_SORT_FIELD = "updatedAt"
export const ROLES_DEFAULT_SORT_ORDER = "desc"

/** Feature-supplied copy and option labels for the Roles filter chips. */
export type RoleChipContext = {
  t: (key: string, options?: Record<string, unknown>) => string
  statusOptions: readonly EnumOption<RoleStatus>[]
}

function dateRangeText(
  from: string,
  to: string,
  t: RoleChipContext["t"]
): string {
  if (from && to) return t("roles.filters.dateRange", { from, to })
  if (from) return t("roles.filters.dateFrom", { date: from })
  return t("roles.filters.dateUntil", { date: to })
}

/**
 * The flat URL format for the Roles table (ADR-0016) and the bar-direction
 * conversion, declared once per filter. The shared URL adapter reads the URL
 * fields; the shared filter module reads `key` and `chip` too.
 */
export const ROLE_FILTER_DESCRIPTORS: readonly TableFilterDescriptor<
  RoleFilterValues,
  RoleFilterKey,
  RoleChipContext
>[] = [
  {
    kind: "text",
    param: "title",
    field: "title",
    key: "title",
    chip: (values, { t }) =>
      t("roles.filters.chipTitle", { value: values.title }),
  },
  {
    kind: "text",
    param: "description",
    field: "description",
    key: "description",
    chip: (values, { t }) =>
      t("roles.filters.chipDescription", { value: values.description }),
  },
  {
    kind: "enumMulti",
    param: "status",
    field: "status",
    values: roleStatusSchema.options,
    key: "status",
    chip: (values, { t, statusOptions }) =>
      t("roles.filters.chipStatus", {
        value: filterValueLabels(values.status, statusOptions),
      }),
  },
  {
    kind: "dateRange",
    fromParam: "createdAtFrom",
    toParam: "createdAtTo",
    field: "createdAt",
    key: "createdAt",
    chip: (values, { t }) =>
      t("roles.filters.chipCreatedAt", {
        value: dateRangeText(values.createdAtFrom, values.createdAtTo, t),
      }),
  },
  {
    kind: "dateRange",
    fromParam: "updatedAtFrom",
    toParam: "updatedAtTo",
    field: "updatedAt",
    key: "updatedAt",
    chip: (values, { t }) =>
      t("roles.filters.chipUpdatedAt", {
        value: dateRangeText(values.updatedAtFrom, values.updatedAtTo, t),
      }),
  },
]

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
  filters: ROLE_FILTER_DESCRIPTORS,
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
