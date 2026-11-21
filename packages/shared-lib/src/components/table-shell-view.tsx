import type { ReactNode } from "react"
import type { Table as TanStackTable } from "@tanstack/react-table"

import { EmptyList, type EmptyListProps } from "./empty-list"
import { ErrorPanel } from "./error-panel"
import { TableGrid } from "./table-grid"
import { TablePagination, type TablePaginationProps } from "./table-pagination"
import { TableSkeleton } from "./table-skeleton"

export type TableShellViewProps<T> = {
  /** TanStack table instance returned by `useTableShell`. */
  table: TanStackTable<T>
  /**
   * State signature from `useTableShell`. The body returns to the top when it
   * changes: page, page size, filter, and sort changes reset, while selection,
   * bulk actions, and refetches do not.
   */
  scrollResetKey: string
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
 * The fitted column every list screen shares: a flexible grid region with a
 * 240px minimum, and a non-shrinking pagination footer. Loading, error, and
 * empty states fill the same region so the frame height never changes as data
 * resolves. Presentational only: the feature supplies every label, width, and
 * empty-state variant in.
 */
const SHELL_CLASS_NAME = "flex min-h-0 flex-1 flex-col gap-4"
const REGION_CLASS_NAME = "flex min-h-[240px] flex-1 flex-col"

type ShellState = "loading" | "error" | "empty" | "ready"

/**
 * The one outer frame every state shares. It keeps the fitted column contract
 * (and the state attribute tests read) in a single place instead of repeating
 * the wrapper in each branch.
 */
function ShellFrame({
  state,
  children,
}: {
  state: ShellState
  children: ReactNode
}) {
  return (
    <div
      className={SHELL_CLASS_NAME}
      data-slot="table-shell"
      data-state={state}
    >
      {children}
    </div>
  )
}

/** The flexible grid region that fills the same area in every data state. */
function ShellRegion({ children }: { children: ReactNode }) {
  return (
    <div className={REGION_CLASS_NAME} data-slot="table-region">
      {children}
    </div>
  )
}

/**
 * Presentational half of the table shell: the loading, error, empty, grid, and
 * pagination states in one place. It owns no data, state, or translated copy —
 * the feature passes every label, width, and empty-state variant in — so the
 * same view serves Roles, Tasks, and Users without hiding their differences.
 */
export function TableShellView<T>({
  table,
  scrollResetKey,
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
      <ShellFrame state="loading">
        <TableSkeleton
          columnWidths={[...skeletonColumnWidths]}
          rowCount={skeletonRowCount}
          label={loadingLabel}
        />
      </ShellFrame>
    )
  }

  if (isError) {
    return (
      <ShellFrame state="error">
        <ShellRegion>
          <ErrorPanel
            title={errorTitle}
            description={errorDescription}
            retryLabel={retryLabel}
            isRetrying={isRetrying}
            onRetry={onRetry}
          />
        </ShellRegion>
      </ShellFrame>
    )
  }

  if (table.getRowModel().rows.length === 0) {
    return (
      <ShellFrame state="empty">
        <ShellRegion>
          <EmptyList {...empty} />
        </ShellRegion>
      </ShellFrame>
    )
  }

  return (
    <ShellFrame state="ready">
      <ShellRegion>
        <TableGrid table={table} scrollResetKey={scrollResetKey} />
      </ShellRegion>
      <div className="shrink-0" data-slot="table-footer">
        <TablePagination {...pagination} />
      </div>
    </ShellFrame>
  )
}
