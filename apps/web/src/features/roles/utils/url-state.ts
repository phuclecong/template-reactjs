import type { CrudFilter, CrudSort } from "@refinedev/core"
import { roleStatusSchema } from "@workspace/api/schemas"
import { DEFAULT_PAGE_SIZE } from "@workspace/shared-lib/hooks/table-defaults"
import { dateOnlyToLocalDate } from "@workspace/ui/lib/date"

import {
  roleFiltersFromCrud,
  roleFiltersToCrud,
  type RoleFilterValues,
} from "@/features/roles/utils/filters"

/** Default sort, matching the table's designed order. */
export const ROLES_DEFAULT_SORT_FIELD = "updatedAt"
export const ROLES_DEFAULT_SORT_ORDER = "desc"

/** Columns the API can sort; an unknown `sort` value falls back to the default. */
const SORTABLE_FIELDS = new Set(["title", "status", "createdAt", "updatedAt"])

/** The URL parameters the Roles table owns; everything else is left alone. */
const OWNED_PARAMS = [
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
] as const

/** Keys written by Refine's old `syncWithLocation` encoding. */
const LEGACY_PARAM = /^(currentPage|(filters|sorters)\[.*\])$/

/** The table state the URL represents: the same shape Refine's `useTable` holds. */
export type RolesUrlState = {
  filters: CrudFilter[]
  sorters: CrudSort[]
  currentPage: number
  pageSize: number
}

function readDate(params: URLSearchParams, key: string): string {
  const value = params.get(key) ?? ""
  // Reject overflowed days such as `2026-02-31`: the filter builder would
  // otherwise throw while rendering.
  return dateOnlyToLocalDate(value) ? value : ""
}

/**
 * Reads the status list, dropping values the Role status enum does not know so
 * a hand-edited URL cannot send an invalid filter to the API.
 */
function readStatus(params: URLSearchParams): string {
  const validStatuses = new Set<string>(roleStatusSchema.options)
  return (params.get("status") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => validStatuses.has(value))
    .join(",")
}

/** Reads a positive integer, falling back when the URL holds junk. */
function readPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Parses flat query parameters into Refine table state. Text filters are raw
 * contains terms, `status` is comma-joined, date bounds are local
 * `YYYY-MM-DD` days, and paging/sorting default to the table's initial state.
 */
export function parseRolesUrlState(params: URLSearchParams): RolesUrlState {
  const sortField = params.get("sort")
  const order = params.get("order")
  const values: RoleFilterValues = {
    title: params.get("title") ?? "",
    description: params.get("description") ?? "",
    status: readStatus(params),
    createdAtFrom: readDate(params, "createdAtFrom"),
    createdAtTo: readDate(params, "createdAtTo"),
    updatedAtFrom: readDate(params, "updatedAtFrom"),
    updatedAtTo: readDate(params, "updatedAtTo"),
  }

  return {
    filters: roleFiltersToCrud(values),
    sorters: [
      {
        field:
          sortField && SORTABLE_FIELDS.has(sortField)
            ? sortField
            : ROLES_DEFAULT_SORT_FIELD,
        order:
          order === "asc" || order === "desc"
            ? order
            : ROLES_DEFAULT_SORT_ORDER,
      },
    ],
    currentPage: readPositiveInt(params.get("page"), 1),
    pageSize: readPositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE),
  }
}

/**
 * Writes table state as flat, URL-encoded query parameters, preserving any
 * parameters the table does not own. Values at their default are omitted, so a
 * pristine table has an empty query string and shared links stay short.
 */
export function buildRolesSearchParams(
  state: RolesUrlState,
  current: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const key of OWNED_PARAMS) params.delete(key)
  // Drop leftover bracket syntax so an old deep link migrates on first write.
  for (const key of [...params.keys()]) {
    if (LEGACY_PARAM.test(key)) params.delete(key)
  }

  const values = roleFiltersFromCrud(state.filters)
  if (values.title) params.set("title", values.title)
  if (values.description) params.set("description", values.description)
  if (values.status) params.set("status", values.status)
  if (values.createdAtFrom) params.set("createdAtFrom", values.createdAtFrom)
  if (values.createdAtTo) params.set("createdAtTo", values.createdAtTo)
  if (values.updatedAtFrom) params.set("updatedAtFrom", values.updatedAtFrom)
  if (values.updatedAtTo) params.set("updatedAtTo", values.updatedAtTo)

  const [primary] = state.sorters
  if (primary && primary.field !== ROLES_DEFAULT_SORT_FIELD) {
    // A non-default field always carries its direction, since "absent order"
    // means descending for whatever field is named.
    params.set("sort", primary.field)
    params.set("order", primary.order)
  } else if (primary && primary.order !== ROLES_DEFAULT_SORT_ORDER) {
    params.set("order", primary.order)
  }

  if (state.currentPage > 1) params.set("page", String(state.currentPage))
  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(state.pageSize))
  }

  return params
}
