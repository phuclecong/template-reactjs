import type { CrudFilter } from "@refinedev/core"
import type { RoleStatus } from "@workspace/api/schemas"
import {
  isDateOnly,
  localDateToDateOnly,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/ui/lib/date"

/**
 * The normalized Roles filter state the filter bar edits. Text values are the
 * raw contains terms, `status` is empty for "All", and every date bound is a
 * local `YYYY-MM-DD` calendar day (the controls' model), while the URL stores
 * UTC instants (see `roleFiltersToCrud`).
 */
export type RoleFilterValues = {
  title: string
  description: string
  status: RoleStatus | ""
  createdAtFrom: string
  createdAtTo: string
  updatedAtFrom: string
  updatedAtTo: string
}

/** The logical filter a chip removes (a date field clears both bounds). */
export type RoleFilterKey = "title" | "description" | "status" | "createdAt" | "updatedAt"

export const EMPTY_ROLE_FILTERS: RoleFilterValues = {
  title: "",
  description: "",
  status: "",
  createdAtFrom: "",
  createdAtTo: "",
  updatedAtFrom: "",
  updatedAtTo: "",
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

/** Converts a stored UTC instant (or legacy date-only value) to a local day. */
function toLocalDateOnly(value: string): string {
  if (!value) return ""
  if (isDateOnly(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : localDateToDateOnly(date)
}

/** Reads Refine's `CrudFilter[]` into the filter bar's editable values. */
export function roleFiltersFromCrud(
  filters: CrudFilter[]
): RoleFilterValues {
  const status = readLeafFilter(filters, "status", "eq")
  return {
    title: readLeafFilter(filters, "title", "contains"),
    description: readLeafFilter(filters, "description", "contains"),
    status: status === "active" || status === "inactive" ? status : "",
    createdAtFrom: toLocalDateOnly(
      readLeafFilter(filters, "createdAt", "gte")
    ),
    createdAtTo: toLocalDateOnly(readLeafFilter(filters, "createdAt", "lte")),
    updatedAtFrom: toLocalDateOnly(
      readLeafFilter(filters, "updatedAt", "gte")
    ),
    updatedAtTo: toLocalDateOnly(readLeafFilter(filters, "updatedAt", "lte")),
  }
}

/**
 * Converts the filter bar's values to Refine filters. Text filters are
 * `contains`; the status filter is `eq` and omitted for "All"; each date From
 * bound becomes the local start of that day as a UTC instant and each To bound
 * the local end of that day, so range bounds are inclusive.
 */
export function roleFiltersToCrud(
  values: RoleFilterValues
): CrudFilter[] {
  const filters: CrudFilter[] = []
  if (values.title) {
    filters.push({ field: "title", operator: "contains", value: values.title })
  }
  if (values.description) {
    filters.push({
      field: "description",
      operator: "contains",
      value: values.description,
    })
  }
  if (values.status) {
    filters.push({ field: "status", operator: "eq", value: values.status })
  }
  if (isDateOnly(values.createdAtFrom)) {
    filters.push({
      field: "createdAt",
      operator: "gte",
      value: localStartOfDayUtcInstant(values.createdAtFrom),
    })
  }
  if (isDateOnly(values.createdAtTo)) {
    filters.push({
      field: "createdAt",
      operator: "lte",
      value: localEndOfDayUtcInstant(values.createdAtTo),
    })
  }
  if (isDateOnly(values.updatedAtFrom)) {
    filters.push({
      field: "updatedAt",
      operator: "gte",
      value: localStartOfDayUtcInstant(values.updatedAtFrom),
    })
  }
  if (isDateOnly(values.updatedAtTo)) {
    filters.push({
      field: "updatedAt",
      operator: "lte",
      value: localEndOfDayUtcInstant(values.updatedAtTo),
    })
  }
  return filters
}

/** Clears one logical filter, including both bounds of a date range. */
export function clearRoleFilter(
  values: RoleFilterValues,
  key: RoleFilterKey
): RoleFilterValues {
  switch (key) {
    case "title":
      return { ...values, title: "" }
    case "description":
      return { ...values, description: "" }
    case "status":
      return { ...values, status: "" }
    case "createdAt":
      return { ...values, createdAtFrom: "", createdAtTo: "" }
    case "updatedAt":
      return { ...values, updatedAtFrom: "", updatedAtTo: "" }
  }
}
