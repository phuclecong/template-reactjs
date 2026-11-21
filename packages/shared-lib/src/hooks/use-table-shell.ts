import { useCallback, useEffect, useMemo, useRef } from "react"
import type { BaseRecord, CrudFilter } from "@refinedev/core"
import { useTable, type UseTableReturnType } from "@refinedev/react-table"
import type { ColumnDef, InitialTableState, Row } from "@tanstack/react-table"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import type { TableUrlState } from "./url-table-state"

/**
 * Configuration for {@link useTableShell}. The feature owns its columns, URL
 * adapter, access rules, and overlays; the shell owns everything Refine's
 * `useTable` needs to make those work together.
 */
export type TableShellConfig<TData extends BaseRecord> = {
  /** Refine resource name, for example `"roles"`. */
  resource: string
  /**
   * Seeds the table from the flat URL parameters on mount. Must be
   * referentially stable (a module-level function).
   */
  parseUrl: (params: URLSearchParams) => TableUrlState
  /**
   * Mirrors table state back into the flat URL parameters. Must be
   * referentially stable (a module-level function), or the mirror effect
   * re-runs on every render.
   */
  buildUrl: (state: TableUrlState, current: URLSearchParams) => URLSearchParams
  /**
   * Column definitions, including any feature-specific gated columns. Must be
   * referentially stable (wrap it in `useMemo`); a fresh array re-seeds the
   * table and can reset a URL-restored page.
   */
  columns: ColumnDef<TData>[]
  /** Stable row identity, usually the record `id`. */
  getRowId: (row: TData) => string
  /**
   * TanStack's selection gate: a boolean for "all rows" or a predicate for
   * per-row rules such as Tasks' `canModifyTask`.
   */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
  /**
   * Initial TanStack table state. Features use `columnVisibility` to keep
   * gated columns defined but hidden until access resolves, which avoids
   * rebuilding `columns` (and resetting a URL-restored page).
   */
  initialState?: InitialTableState
}

/**
 * The table state the shell derives from Refine. `refineCore` and `reactTable`
 * are passed through untouched so features keep full control of row actions,
 * overlays, refetches, and column visibility.
 */
export type TableShell<TData extends BaseRecord> = {
  reactTable: UseTableReturnType<TData>["reactTable"]
  refineCore: UseTableReturnType<TData>["refineCore"]
  filters: CrudFilter[]
  tableQuery: UseTableReturnType<TData>["refineCore"]["tableQuery"]
  /** One-based current page, matching the URL and pagination component. */
  page: number
  pageSize: number
  /** At least one, even while loading or when the list is empty. */
  pageCount: number
  total: number
  /**
   * Signature of page, page size, filters, and sort. It changes whenever the
   * list request changes, so the fitted table body can reset its scroll on
   * exactly those transitions (never on selection or a refetch).
   */
  stateKey: string
  /** Rows selected on the current page, in render order. */
  selectedRows: TData[]
  clearSelection: () => void
  goToPage: (page: number) => void
  changePageSize: (pageSize: number) => void
  /** Stable identity so debounced filter bars do not re-arm on every render. */
  changeFilters: (filters: CrudFilter[]) => void
}

/**
 * One Refine table shell for every server-paged list. It owns the duplicated
 * core the 2026-11-21 review identified — URL seed and mirror, `useTable`
 * wiring, server pagination handlers, page-scoped selection and its reset, and
 * the page/total trio — while leaving columns, headers, filters, overlay
 * strategy, access gating, and copy with the feature. See ADR-0015's
 * amendment: `refineCore` and `reactTable` stay exposed so no Refine option is
 * hidden.
 *
 * **Stability contract:** `parseUrl`, `buildUrl`, and `columns` must keep the
 * same identity across renders — define `parseUrl`/`buildUrl` at module level
 * and wrap `columns` in `useMemo`. They feed the URL seed memo and the mirror
 * effect; a fresh function or array each render re-runs those effects and can
 * rewrite the URL or reset a restored page.
 */
export function useTableShell<TData extends BaseRecord>({
  resource,
  parseUrl,
  buildUrl,
  columns,
  getRowId,
  enableRowSelection,
  initialState,
}: TableShellConfig<TData>): TableShell<TData> {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()

  // The URL seeds `useTable` on mount. It is re-parsed whenever the query
  // string changes so Refine's "empty search" reset sees the current defaults;
  // after that, table state is the source of truth and the effect below
  // mirrors it back into the URL.
  const urlState = useMemo(
    () => parseUrl(searchParams),
    [parseUrl, searchParams]
  )

  const { reactTable, refineCore } = useTable<TData>({
    refineCoreProps: {
      resource,
      // Refine's sync serializes `filters[0][value]` without encoding values.
      // Each feature owns a flat, encoded URL format instead (ADR-0016).
      syncWithLocation: false,
      pagination: {
        currentPage: urlState.currentPage,
        pageSize: urlState.pageSize,
        mode: "server",
      },
      sorters: { initial: urlState.sorters, mode: "server" },
      filters: { initial: urlState.filters, mode: "server" },
    },
    columns,
    getRowId,
    // Every feature keeps its designed order: a third click does not clear the
    // sort. This is the shell's fixed behaviour, not a per-feature option.
    enableSortingRemoval: false,
    enableRowSelection,
    initialState,
  })

  const {
    tableQuery,
    pageCount,
    result,
    filters,
    sorters,
    currentPage: refineCurrentPage,
    pageSize: refinePageSize,
    setFilters,
    setCurrentPage,
  } = refineCore

  // Table state is the source of truth while mounted. Mirror it into the URL
  // with flat, encoded keys, skipping the write when the URL already matches so
  // our own navigation never re-enters this effect as a change.
  useEffect(() => {
    const next = buildUrl(
      {
        filters,
        sorters,
        currentPage: refineCurrentPage,
        pageSize: refinePageSize,
      },
      searchParams
    )
    const nextSearch = next.toString()
    if (nextSearch === searchParams.toString()) return
    navigate(
      { pathname, hash, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true }
    )
  }, [
    buildUrl,
    filters,
    sorters,
    refineCurrentPage,
    refinePageSize,
    searchParams,
    navigate,
    pathname,
    hash,
  ])

  const rows = reactTable.getRowModel().rows
  const { pageIndex, pageSize } = reactTable.getState().pagination
  const page = pageIndex + 1
  const total = result.total ?? 0

  // Selection is uncontrolled TanStack state, mirrored here for the bulk bar.
  // A selection must never outlive the rows it names, so every handler that can
  // change the visible rows clears it before the new state lands.
  const rowSelection = reactTable.getState().rowSelection
  const clearSelection = useCallback(() => {
    reactTable.resetRowSelection()
  }, [reactTable])

  // State-driven reset: a reload from a shared URL or an action that changes
  // rows outside the handlers below must not leave a selection behind. Keying
  // on a value signature means unrelated re-renders never touch the selection.
  // The same signature is exposed as `stateKey` so the table body resets its
  // scroll on exactly the transitions that change the list request.
  const stateKey = JSON.stringify({
    filters,
    sorters,
    currentPage: refineCurrentPage,
    pageSize: refinePageSize,
  })
  const lastStateKey = useRef(stateKey)
  useEffect(() => {
    if (lastStateKey.current === stateKey) return
    lastStateKey.current = stateKey
    reactTable.resetRowSelection()
  }, [stateKey, reactTable])

  const selectedRows = rows
    .filter((row) => rowSelection[row.id] === true)
    .map((row) => row.original)

  const goToPage = useCallback(
    (nextPage: number) => {
      reactTable.resetRowSelection()
      reactTable.setPageIndex(Math.max(0, nextPage - 1))
    },
    [reactTable]
  )

  const changePageSize = useCallback(
    (nextPageSize: number) => {
      reactTable.resetRowSelection()
      reactTable.setPageSize(nextPageSize)
      reactTable.setPageIndex(0)
    },
    [reactTable]
  )

  // Filter state is owned by Refine core and mirrored to the URL above. Any
  // change replaces the filters and returns to page 1; both pagination layers
  // are updated because Refine does not reset the page for `setFilters` on its
  // own. `useCallback` keeps a debounced filter bar from re-arming.
  const changeFilters = useCallback(
    (nextFilters: CrudFilter[]) => {
      reactTable.resetRowSelection()
      setFilters(nextFilters, "replace")
      setCurrentPage(1)
      reactTable.setPageIndex(0)
    },
    [reactTable, setFilters, setCurrentPage]
  )

  return {
    reactTable,
    refineCore,
    filters,
    tableQuery,
    page,
    pageSize,
    pageCount: Math.max(1, pageCount),
    total,
    stateKey,
    selectedRows,
    clearSelection,
    goToPage,
    changePageSize,
    changeFilters,
  }
}
