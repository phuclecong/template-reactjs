import type { CrudFilter } from "@refinedev/core"
import {
  clear as clearFilters,
  deriveChips,
  fromCrud,
  toCrud,
  type TableFilterChip,
} from "@workspace/shared-lib/utils"

import { ROLE_FILTER_DESCRIPTORS, type RoleChipContext } from "./url-state"

/**
 * The normalized Roles filter state the filter bar edits. Text values are the
 * raw contains terms, `status` is a comma-joined list (empty means no status
 * filter), and every date bound is a local `YYYY-MM-DD` calendar day (the
 * controls' model), while the URL stores UTC instants.
 */
export type RoleFilterValues = {
  title: string
  description: string
  status: string
  createdAtFrom: string
  createdAtTo: string
  updatedAtFrom: string
  updatedAtTo: string
}

/** The logical filter a chip removes (a date field clears both bounds). */
export type RoleFilterKey =
  | "title"
  | "description"
  | "status"
  | "createdAt"
  | "updatedAt"

export const EMPTY_ROLE_FILTERS: RoleFilterValues = {
  title: "",
  description: "",
  status: "",
  createdAtFrom: "",
  createdAtTo: "",
  updatedAtFrom: "",
  updatedAtTo: "",
}

/** Reads Refine's `CrudFilter[]` into the filter bar's editable values. */
export function roleFiltersFromCrud(filters: CrudFilter[]): RoleFilterValues {
  return fromCrud(ROLE_FILTER_DESCRIPTORS, filters)
}

/** Converts the filter bar's values to Refine filters. */
export function roleFiltersToCrud(values: RoleFilterValues): CrudFilter[] {
  return toCrud(ROLE_FILTER_DESCRIPTORS, values)
}

/** Clears one logical filter, including both bounds of a date range. */
export function clearRoleFilter(
  values: RoleFilterValues,
  key: RoleFilterKey
): RoleFilterValues {
  return clearFilters(ROLE_FILTER_DESCRIPTORS, values, key)
}

/** Derives the active-filter chips; copy comes from the bar's context. */
export function roleFilterChips(
  values: RoleFilterValues,
  context: RoleChipContext
): TableFilterChip<RoleFilterKey>[] {
  return deriveChips(ROLE_FILTER_DESCRIPTORS, values, context)
}
