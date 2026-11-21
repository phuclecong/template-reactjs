import type { CrudFilter } from "@refinedev/core"
import {
  dateOnlyToLocalDate,
  isDateOnly,
  localDateToDateOnly,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/date-utils"

import { parseFilterValues } from "./filter-values"
import type { TableUrlFilterDescriptor } from "./table-url-descriptors"

/** The editable values a filter bar holds, keyed by each filter's value key. */
export type FilterValues = Record<string, string>

/**
 * A filter declaration shared by both conversion directions. The URL fields
 * (`kind`, `param`/`fromParam`/`toParam`, `field`, `values`) are the same ones
 * `createTableUrlAdapter` consumes; `key` and `chip` are the bar-direction
 * extras. Declaring one object per filter keeps the URL, API filters, and the
 * bar from drifting apart.
 */
export type TableFilterDescriptor<
  TValues extends FilterValues,
  TKey extends string = string,
  TChipContext = void,
> = TableUrlFilterDescriptor<TValues> & {
  /** Logical key used by `clear` and chip removal. */
  key: TKey
  /**
   * Builds the chip copy for the current values. Only called while the filter
   * has a value. `context` carries feature-supplied copy and option labels, so
   * this module stays free of i18n.
   */
  chip: (values: TValues, context: TChipContext) => string
}

/** Reads a leaf filter for the field/operator pair, or an empty string. */
export function readLeafFilter(
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
 * Reads a multi-value filter for the field as a comma-joined list. A single
 * value may arrive as `eq` (what the UI emits); several arrive as `in`. Values
 * outside `valid` are dropped.
 */
export function readEnumFilter(
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
export function toLocalDateOnly(value: string): string {
  if (!value) return ""
  if (isDateOnly(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : localDateToDateOnly(date)
}

/** The value keys a descriptor owns: both date bounds, or its single key. */
function descriptorValueKeys(descriptor: TableUrlFilterDescriptor): string[] {
  return descriptor.kind === "dateRange"
    ? [descriptor.fromParam, descriptor.toParam]
    : [descriptor.param]
}

/** True when at least one of the descriptor's values is non-empty. */
function hasFilterValue(
  descriptor: TableUrlFilterDescriptor,
  values: FilterValues
): boolean {
  return descriptorValueKeys(descriptor).some((key) => Boolean(values[key]))
}

/** One active filter chip: the logical key plus feature-supplied copy. */
export type TableFilterChip<TKey extends string = string> = {
  key: TKey
  label: string
}

/**
 * Clears the values owned by one logical filter. A date range clears both
 * bounds; an unknown key leaves the values untouched.
 */
export function clear<
  TValues extends FilterValues,
  TKey extends string,
  TChipContext,
>(
  descriptors: readonly TableFilterDescriptor<TValues, TKey, TChipContext>[],
  values: TValues,
  key: TKey
): TValues {
  const next: FilterValues = { ...values }
  for (const descriptor of descriptors) {
    if (descriptor.key !== key) continue
    for (const valueKey of descriptorValueKeys(descriptor)) {
      next[valueKey] = ""
    }
  }
  return next as TValues
}

/**
 * Derives the active-filter chips in descriptor order. A filter is active
 * when any value it owns is non-empty; its label comes from the descriptor,
 * which receives feature-supplied copy and option labels via `context`.
 */
export function deriveChips<
  TValues extends FilterValues,
  TKey extends string,
  TChipContext,
>(
  descriptors: readonly TableFilterDescriptor<TValues, TKey, TChipContext>[],
  values: TValues,
  context: TChipContext
): TableFilterChip<TKey>[] {
  const chips: TableFilterChip<TKey>[] = []
  for (const descriptor of descriptors) {
    if (!hasFilterValue(descriptor, values)) continue
    chips.push({
      key: descriptor.key,
      label: descriptor.chip(values, context),
    })
  }
  return chips
}

/**
 * Maps a comma-joined filter value to its option labels, falling back to the
 * raw value so chips stay readable for options that have since disappeared.
 */
export function filterValueLabels(
  value: string,
  options: readonly { value: string; label: string }[]
): string {
  return parseFilterValues(value)
    .map(
      (part) => options.find((option) => option.value === part)?.label ?? part
    )
    .join(", ")
}

/** Feature-supplied copy for each shape a date-range phrase can take. */
export type DateRangeTextCopy = {
  range: (from: string, to: string) => string
  from: (date: string) => string
  until: (date: string) => string
}

/**
 * Formats a date-range phrase from feature-supplied copy. The bound selection
 * lives here once; the words and locale stay with the feature, so this module
 * remains i18n-free.
 */
export function dateRangeText(
  from: string,
  to: string,
  copy: DateRangeTextCopy
): string {
  if (from && to) return copy.range(from, to)
  if (from) return copy.from(from)
  return copy.until(to)
}

/** Reads Refine's `CrudFilter[]` into the filter bar's editable values. */
export function fromCrud<TValues extends FilterValues>(
  descriptors: readonly TableUrlFilterDescriptor<TValues>[],
  filters: CrudFilter[]
): TValues {
  const values: FilterValues = {}
  for (const descriptor of descriptors) {
    switch (descriptor.kind) {
      case "text":
        values[descriptor.param] = readLeafFilter(
          filters,
          descriptor.field,
          "contains"
        )
        break
      case "enumMulti":
        values[descriptor.param] = readEnumFilter(
          filters,
          descriptor.field,
          descriptor.values ? new Set(descriptor.values) : undefined
        )
        break
      case "dateRange":
        values[descriptor.fromParam] = toLocalDateOnly(
          readLeafFilter(filters, descriptor.field, "gte")
        )
        values[descriptor.toParam] = toLocalDateOnly(
          readLeafFilter(filters, descriptor.field, "lte")
        )
        break
    }
  }
  return values as TValues
}

/** Converts the filter bar's values to Refine filters. */
export function toCrud<TValues extends FilterValues>(
  descriptors: readonly TableUrlFilterDescriptor<TValues>[],
  values: TValues
): CrudFilter[] {
  const filters: CrudFilter[] = []
  for (const descriptor of descriptors) {
    switch (descriptor.kind) {
      case "text": {
        const value = values[descriptor.param] ?? ""
        if (value) {
          filters.push({
            field: descriptor.field,
            operator: "contains",
            value,
          })
        }
        break
      }
      case "enumMulti": {
        const selected = parseFilterValues(values[descriptor.param] ?? "")
        const [only] = selected
        if (selected.length > 1) {
          filters.push({
            field: descriptor.field,
            operator: "in",
            value: selected,
          })
        } else if (only) {
          filters.push({
            field: descriptor.field,
            operator: "eq",
            value: only,
          })
        }
        break
      }
      case "dateRange": {
        // Calendar-validate the day: an invalid or overflowed date such as
        // `2026-02-31` means no bound, never a throw.
        const from = values[descriptor.fromParam] ?? ""
        const start = dateOnlyToLocalDate(from)
          ? localStartOfDayUtcInstant(from)
          : null
        if (start) {
          filters.push({
            field: descriptor.field,
            operator: "gte",
            value: start,
          })
        }
        const to = values[descriptor.toParam] ?? ""
        const end = dateOnlyToLocalDate(to) ? localEndOfDayUtcInstant(to) : null
        if (end) {
          filters.push({
            field: descriptor.field,
            operator: "lte",
            value: end,
          })
        }
        break
      }
    }
  }
  return filters
}
