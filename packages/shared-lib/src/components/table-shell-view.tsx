import type { Table as TanStackTable } from "@tanstack/react-table"

import { EmptyList, type EmptyListProps } from "./empty-list"
import { ErrorPanel } from "./error-panel"
import { TableGrid } from "./table-grid"
import { TablePagination, type TablePaginationProps } from "./table-pagination"
import { TableSkeleton } from "./table-skeleton"

export type TableShellViewProps<T> = {
  /** TanStack table instance returned by `useTableShell`. */
  table: TanStackTable<T>
  isLoading: boolean
  isError: boolean
  /** Whether a retry request is already in flight. */
  isRetrying?: boolean
  onRetry: () => void
  /** Translated loading announcement for assistive technology. */
  loadingLabel: string
  /** Per-feature pixel widths, including gated columns the feature reserves. */
  skeletonColumnWidths: readonly number[]
  /** Placeholder row count, normally the active page size. */
  skeletonRowCount: number
  /** Translated failure summary, for example "Could not load roles.". */
  errorTitle: string
  /**
   * Translated failure detail. Features build this with `describeError`, so
   * the shared view stays independent of any app-specific error formatter.
   */
  errorDescription?: string
  /** Translated retry control label. */
  retryLabel: string
  /**
   * Feature-supplied empty state: title, optional description, and optional
   * action. Switch to a no-match title/description when filters are active.
   */
  empty: EmptyListProps
  /**
   * Pagination state and handlers, passed through to `TablePagination`. The
   * summary is translated by the feature, for example "60 roles".
   */
  pagination: TablePaginationProps
}

/**
 * Presentational half of the table shell: the loading, error, empty, grid, and
 * pagination states in one place. It owns no data, state, or translated copy —
 * the feature passes every label, width, and empty-state variant in — so the
 * same view serves Roles, Tasks, and Users without hiding their differences.
 */
export function TableShellView<T>({
  table,
  isLoading,
  isError,
  isRetrying = false,
  onRetry,
  loadingLabel,
  skeletonColumnWidths,
  skeletonRowCount,
  errorTitle,
  errorDescription,
  retryLabel,
  empty,
  pagination,
}: TableShellViewProps<T>) {
  if (isLoading) {
    return (
      <TableSkeleton
        columnWidths={[...skeletonColumnWidths]}
        rowCount={skeletonRowCount}
        label={loadingLabel}
      />
    )
  }

  if (isError) {
    return (
      <ErrorPanel
        title={errorTitle}
        description={errorDescription}
        retryLabel={retryLabel}
        isRetrying={isRetrying}
        onRetry={onRetry}
      />
    )
  }

  if (table.getRowModel().rows.length === 0) {
    return <EmptyList {...empty} />
  }

  return (
    <>
      <TableGrid table={table} />
      <TablePagination {...pagination} />
    </>
  )
}
