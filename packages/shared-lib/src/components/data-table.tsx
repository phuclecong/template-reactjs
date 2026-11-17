import { useTranslation } from "react-i18next"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { TableGrid } from "./table-grid"
import { TablePagination } from "./table-pagination"
import { TableSkeleton } from "./table-skeleton"

type DataTablePagination = {
  page: number
  pageSize: number
  pageCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

type DataTableProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  getRowId: (row: T) => string
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  enableRowSelection?: (row: Row<T>) => boolean
  isLoading?: boolean
  loadingLabel?: string
  emptyLabel?: string
  pagination: DataTablePagination
}

/**
 * Reusable server-paginated table shell. Owns the TanStack table plus the
 * sortable header/body, loading/empty states, and the pagination footer. The
 * caller supplies columns, row identity, selection state, and pagination
 * wiring; filters and bulk/row actions live outside this component.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection,
  isLoading = false,
  loadingLabel,
  emptyLabel,
  pagination,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange,
    onRowSelectionChange,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection,
    enableSortingRemoval: false,
    manualSorting: true,
    manualPagination: true,
  })

  const showFooter = data.length > 0

  // Headers exist even before data arrives, so their sizes reserve exactly the
  // layout the real table will use. The placeholder renders no table semantics
  // (see `TableSkeleton`).
  const columnWidths = (table.getHeaderGroups()[0]?.headers ?? []).map(
    (header) => header.getSize()
  )

  return (
    <>
      {isLoading ? (
        <TableSkeleton
          columnWidths={columnWidths}
          rowCount={pagination.pageSize}
          label={loadingLabel ?? t("common.loading")}
        />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">{emptyLabel}</p>
      ) : (
        <TableGrid table={table} />
      )}

      {showFooter && (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          pageCount={pagination.pageCount}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </>
  )
}
