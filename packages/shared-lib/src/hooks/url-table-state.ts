import type { CrudFilter, CrudSort } from "@refinedev/core"
import {
  dateOnlyToLocalDate,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/date-utils"

import type { TableUrlFilterDescriptor } from "../utils/table-url-descriptors"
import {
  readEnumFilter,
  readLeafFilter,
  toLocalDateOnly,
} from "../utils/table-filters"
import { DEFAULT_PAGE_SIZE } from "./table-defaults"

export type TableUrlAdapterConfig = {
  /** Sort field used when the URL holds no valid `sort` value. */
  defaultSortField: string
  /** Direction used when the URL holds no valid `order` value. */
  defaultSortOrder?: "asc" | "desc"
  /** Page size used when the URL holds no valid `pageSize` value. */
  defaultPageSize?: number
  /** Columns the API can sort; an unknown `sort` value falls back. */
  sortableFields: readonly string[]
  /** URL parameters this table owns; every other parameter is preserved. */
  ownedParams: readonly string[]
  /** Optional matcher for obsolete keys that are dropped on the first write. */
  legacyParamPattern?: RegExp
  /** The filters the URL represents, in display order. */
  filters: readonly TableUrlFilterDescriptor[]
}

/** The table state a URL represents: the same shape Refine's `useTable` holds. */
export type TableUrlState = {
  filters: CrudFilter[]
  sorters: CrudSort[]
  currentPage: number
  pageSize: number
}

export type TableUrlAdapter = {
  /** Parses the query string into Refine table state. */
  parse: (params: URLSearchParams) => TableUrlState
  /** Writes table state as flat, encoded query parameters. */
  build: (state: TableUrlState, current: URLSearchParams) => URLSearchParams
}

function readDate(params: URLSearchParams, key: string): string {
  const value = params.get(key) ?? ""
  // Reject overflowed days such as `2026-02-31`: the filter builder would
  // otherwise throw while rendering.
  return dateOnlyToLocalDate(value) ? value : ""
}

/** Reads a positive integer, falling back when the URL holds junk. */
function readPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseFilter(
  descriptor: TableUrlFilterDescriptor,
  params: URLSearchParams
): CrudFilter[] {
  switch (descriptor.kind) {
    case "text": {
      const value = params.get(descriptor.param) ?? ""
      return value
        ? [{ field: descriptor.field, operator: "contains", value }]
        : []
    }
    case "enumMulti": {
      const valid = descriptor.values
        ? new Set<string>(descriptor.values)
        : undefined
      const values = (params.get(descriptor.param) ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(
          (value) => value !== "" && (valid === undefined || valid.has(value))
        )
      const [onlyValue] = values
      if (values.length > 1) {
        return [{ field: descriptor.field, operator: "in", value: values }]
      }
      return onlyValue
        ? [{ field: descriptor.field, operator: "eq", value: onlyValue }]
        : []
    }
    case "dateRange": {
      const filters: CrudFilter[] = []
      const from = readDate(params, descriptor.fromParam)
      const start = from ? localStartOfDayUtcInstant(from) : null
      if (start) {
        filters.push({
          field: descriptor.field,
          operator: "gte",
          value: start,
        })
      }
      const to = readDate(params, descriptor.toParam)
      const end = to ? localEndOfDayUtcInstant(to) : null
      if (end) {
        filters.push({
          field: descriptor.field,
          operator: "lte",
          value: end,
        })
      }
      return filters
    }
  }
}

function writeFilter(
  descriptor: TableUrlFilterDescriptor,
  state: TableUrlState,
  params: URLSearchParams
): void {
  switch (descriptor.kind) {
    case "text": {
      const value = readLeafFilter(state.filters, descriptor.field, "contains")
      if (value) params.set(descriptor.param, value)
      return
    }
    case "enumMulti": {
      const valid = descriptor.values
        ? new Set<string>(descriptor.values)
        : undefined
      const value = readEnumFilter(state.filters, descriptor.field, valid)
      if (value) params.set(descriptor.param, value)
      return
    }
    case "dateRange": {
      const from = toLocalDateOnly(
        readLeafFilter(state.filters, descriptor.field, "gte")
      )
      if (from) params.set(descriptor.fromParam, from)
      const to = toLocalDateOnly(
        readLeafFilter(state.filters, descriptor.field, "lte")
      )
      if (to) params.set(descriptor.toParam, to)
    }
  }
}

/**
 * Builds a two-way adapter between a table's flat URL parameters and the
 * `CrudFilter[]`/`CrudSort[]`/pagination shape `@refinedev/react-table`'s
 * `useTable` consumes. Feature tables supply only a descriptor config; the
 * encoding, validation, and date-bound rules live here once.
 *
 * Values at their default are omitted, so a pristine table has an empty query
 * string. Unknown sort, order, page, and page-size values fall back, and enum
 * or date values the contract does not know are dropped.
 */
export function createTableUrlAdapter(
  config: TableUrlAdapterConfig
): TableUrlAdapter {
  const sortableFields = new Set(config.sortableFields)
  const defaultOrder = config.defaultSortOrder ?? "asc"
  const defaultPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE

  return {
    parse(params) {
      const sortField = params.get("sort")
      const order = params.get("order")

      return {
        filters: config.filters.flatMap((descriptor) =>
          parseFilter(descriptor, params)
        ),
        sorters: [
          {
            field:
              sortField && sortableFields.has(sortField)
                ? sortField
                : config.defaultSortField,
            order: order === "asc" || order === "desc" ? order : defaultOrder,
          },
        ],
        currentPage: readPositiveInt(params.get("page"), 1),
        pageSize: readPositiveInt(params.get("pageSize"), defaultPageSize),
      }
    },

    build(state, current) {
      const params = new URLSearchParams(current)
      for (const key of config.ownedParams) params.delete(key)
      // Drop leftover bracket syntax so an old deep link migrates on first write.
      if (config.legacyParamPattern) {
        for (const key of [...params.keys()]) {
          if (config.legacyParamPattern.test(key)) params.delete(key)
        }
      }

      for (const descriptor of config.filters) {
        writeFilter(descriptor, state, params)
      }

      const [primary] = state.sorters
      if (primary && primary.field !== config.defaultSortField) {
        // A non-default field always carries its direction, since "absent
        // order" means the default direction for whatever field is named.
        params.set("sort", primary.field)
        params.set("order", primary.order)
      } else if (primary && primary.order !== defaultOrder) {
        params.set("order", primary.order)
      }

      if (state.currentPage > 1) {
        params.set("page", String(state.currentPage))
      }
      if (state.pageSize !== defaultPageSize) {
        params.set("pageSize", String(state.pageSize))
      }

      return params
    },
  }
}
