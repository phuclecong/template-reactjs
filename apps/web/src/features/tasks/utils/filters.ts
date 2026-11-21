import type { CrudFilter } from "@refinedev/core"
import {
  clear as clearFilters,
  deriveChips,
  fromCrud,
  toCrud,
  type TableFilterChip,
} from "@workspace/shared-lib/utils"

import { TASK_FILTER_DESCRIPTORS, type TaskChipContext } from "./url-state"

/**
 * The normalized Tasks filter state the filter bar edits and the shared URL
 * adapter round-trips. Values are the raw URL values: `q` is the search term,
 * status/priority/assignee are comma-joined lists, and the due bounds are local
 * `YYYY-MM-DD` calendar days.
 */
export type TaskFilterValues = {
  q: string
  status: string
  priority: string
  assignee: string
  dueFrom: string
  dueTo: string
}

/** The logical filter a chip removes (the due date clears both bounds). */
export type TaskFilterKey = "q" | "status" | "priority" | "assignee" | "dueDate"

/** Every filter cleared. */
export const EMPTY_TASK_FILTERS: TaskFilterValues = {
  q: "",
  status: "",
  priority: "",
  assignee: "",
  dueFrom: "",
  dueTo: "",
}

/**
 * Reads Refine's `CrudFilter[]` into the filter bar's editable values. The
 * table's URL adapter produces the same filters from the query string, so the
 * bar's controls, chips, and URL always agree.
 */
export function taskFiltersFromCrud(filters: CrudFilter[]): TaskFilterValues {
  return fromCrud(TASK_FILTER_DESCRIPTORS, filters)
}

/** Converts the filter bar's values to Refine filters. */
export function taskFiltersToCrud(values: TaskFilterValues): CrudFilter[] {
  return toCrud(TASK_FILTER_DESCRIPTORS, values)
}

/** Clears one logical filter, including both bounds of the due-date range. */
export function clearTaskFilter(
  values: TaskFilterValues,
  key: TaskFilterKey
): TaskFilterValues {
  return clearFilters(TASK_FILTER_DESCRIPTORS, values, key)
}

/** Derives the active-filter chips; copy comes from the bar's context. */
export function taskFilterChips(
  values: TaskFilterValues,
  context: TaskChipContext
): TableFilterChip<TaskFilterKey>[] {
  return deriveChips(TASK_FILTER_DESCRIPTORS, values, context)
}
