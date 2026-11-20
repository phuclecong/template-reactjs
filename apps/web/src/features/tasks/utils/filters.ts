import type { CrudFilter } from "@refinedev/core"
import { taskPrioritySchema, taskStatusSchema } from "@workspace/api/schemas"
import { parseFilterValues } from "@workspace/shared-lib/utils"
import {
  dateOnlyToLocalDate,
  isDateOnly,
  localDateToDateOnly,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/ui/lib/date"

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

function readLeafFilter(
  filters: CrudFilter[],
  field: string,
  operator: CrudFilter["operator"]
): string {
  for (const filter of filters) {
    if (
      "field" in filter &&
      filter.field === field &&
      filter.operator === operator
    ) {
      return typeof filter.value === "string"
        ? filter.value
        : filter.value == null
          ? ""
          : String(filter.value)
    }
  }
  return ""
}

/**
 * Reads a multi-value filter as a comma-joined list. A single value may arrive
 * as `eq` (what the UI emits); several arrive as `in`. Unlike the Roles status
 * filter, assignee ids cannot be validated against a fixed list.
 */
function readMultiFilter(
  filters: CrudFilter[],
  field: string,
  valid: ReadonlySet<string> | undefined
): string {
  for (const filter of filters) {
    if (!("field" in filter) || filter.field !== field) continue
    const rawValues =
      filter.operator === "in" && Array.isArray(filter.value)
        ? filter.value
        : filter.operator === "eq"
          ? [filter.value]
          : []
    const values = rawValues.filter(
      (value): value is string =>
        typeof value === "string" && (valid === undefined || valid.has(value))
    )
    if (values.length > 0) return values.join(",")
  }
  return ""
}

/** Converts a stored UTC instant (or legacy date-only value) to a local day. */
function toLocalDateOnly(value: string): string {
  if (!value) return ""
  if (isDateOnly(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : localDateToDateOnly(date)
}

/**
 * Reads Refine's `CrudFilter[]` into the filter bar's editable values. The
 * table's URL adapter produces the same filters from the query string, so the
 * bar's controls, chips, and URL always agree.
 */
export function taskFiltersFromCrud(
  filters: CrudFilter[]
): TaskFilterValues {
  return {
    q: readLeafFilter(filters, "q", "contains"),
    status: readMultiFilter(
      filters,
      "status",
      new Set<string>(taskStatusSchema.options)
    ),
    priority: readMultiFilter(
      filters,
      "priority",
      new Set<string>(taskPrioritySchema.options)
    ),
    assignee: readMultiFilter(filters, "assigneeId", undefined),
    dueFrom: toLocalDateOnly(readLeafFilter(filters, "dueDate", "gte")),
    dueTo: toLocalDateOnly(readLeafFilter(filters, "dueDate", "lte")),
  }
}

/**
 * Converts the filter bar's values to Refine filters: the search term is a
 * `contains` on `q`; status, priority, and assignee are `eq` for one value and
 * `in` for several; each due From bound becomes the local start of that day as
 * a UTC instant and each To bound the local end of that day.
 */
export function taskFiltersToCrud(values: TaskFilterValues): CrudFilter[] {
  const filters: CrudFilter[] = []
  if (values.q) {
    filters.push({ field: "q", operator: "contains", value: values.q })
  }

  const statuses = parseFilterValues(values.status)
  const [onlyStatus] = statuses
  if (statuses.length > 1) {
    filters.push({ field: "status", operator: "in", value: statuses })
  } else if (onlyStatus) {
    filters.push({ field: "status", operator: "eq", value: onlyStatus })
  }

  const priorities = parseFilterValues(values.priority)
  const [onlyPriority] = priorities
  if (priorities.length > 1) {
    filters.push({ field: "priority", operator: "in", value: priorities })
  } else if (onlyPriority) {
    filters.push({ field: "priority", operator: "eq", value: onlyPriority })
  }

  const assignees = parseFilterValues(values.assignee)
  const [onlyAssignee] = assignees
  if (assignees.length > 1) {
    filters.push({ field: "assigneeId", operator: "in", value: assignees })
  } else if (onlyAssignee) {
    filters.push({ field: "assigneeId", operator: "eq", value: onlyAssignee })
  }

  // `dateOnlyToLocalDate` rejects overflowed days such as `2026-02-31`; a
  // regex-only check would let the date helper throw while rendering.
  if (dateOnlyToLocalDate(values.dueFrom)) {
    filters.push({
      field: "dueDate",
      operator: "gte",
      value: localStartOfDayUtcInstant(values.dueFrom),
    })
  }
  if (dateOnlyToLocalDate(values.dueTo)) {
    filters.push({
      field: "dueDate",
      operator: "lte",
      value: localEndOfDayUtcInstant(values.dueTo),
    })
  }

  return filters
}

/** Clears one logical filter, including both bounds of the due-date range. */
export function clearTaskFilter(
  values: TaskFilterValues,
  key: TaskFilterKey
): TaskFilterValues {
  switch (key) {
    case "q":
      return { ...values, q: "" }
    case "status":
      return { ...values, status: "" }
    case "priority":
      return { ...values, priority: "" }
    case "assignee":
      return { ...values, assignee: "" }
    case "dueDate":
      return { ...values, dueFrom: "", dueTo: "" }
  }
}
