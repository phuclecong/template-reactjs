/**
 * URL filter descriptor types, kept below the hooks that consume them so the
 * filter-conversion utils can import them without depending on a hook module.
 */

/** A single text filter stored as one raw URL parameter. */
export type TableUrlTextFilter<TParam extends string = string> = {
  kind: "text"
  /** URL parameter and bar value key. */
  param: TParam
  /** API field the `contains` filter targets. */
  field: string
}

/**
 * A multi-value filter stored as one comma-joined URL parameter and expanded
 * to an `in` filter (or `eq` for a single value). `values` restricts the
 * accepted options; omit it for open-ended fields such as assignee ids.
 */
export type TableUrlEnumMultiFilter<TParam extends string = string> = {
  kind: "enumMulti"
  /** URL parameter and bar value key. */
  param: TParam
  /** API field the `in`/`eq` filter targets. */
  field: string
  values?: readonly string[]
}

/**
 * A date-range filter stored as two local `YYYY-MM-DD` URL parameters. The
 * `parse` direction expands them to inclusive UTC instants for the API; the
 * `build` direction collapses stored instants back to local days.
 */
export type TableUrlDateRangeFilter<TParam extends string = string> = {
  kind: "dateRange"
  /** URL parameter and bar value key for the inclusive lower bound. */
  fromParam: TParam
  /** URL parameter and bar value key for the inclusive upper bound. */
  toParam: TParam
  /** API field the `gte`/`lte` filters target. */
  field: string
}

/**
 * The value keys a descriptor may own, restricted to the bar's value shape.
 * Naming a key the feature does not declare is a type error, so a renamed
 * value key cannot silently drift from the conversion casts.
 */
type ValueKey<TValues extends Record<string, string>> = keyof TValues & string

/**
 * One filter declaration. `TValues` links the descriptor's value keys to the
 * shape `fromCrud`/`toCrud` exchange; the default accepts any string key for
 * URL-only configurations that carry no typed bar values.
 */
export type TableUrlFilterDescriptor<
  TValues extends Record<string, string> = Record<string, string>,
> =
  | TableUrlTextFilter<ValueKey<TValues>>
  | TableUrlEnumMultiFilter<ValueKey<TValues>>
  | TableUrlDateRangeFilter<ValueKey<TValues>>
