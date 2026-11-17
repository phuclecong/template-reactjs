import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCan } from "@refinedev/core"
import { useTable } from "@refinedev/react-table"
import { flexRender, type ColumnDef } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import type { RoleRecord } from "@workspace/api/schemas"
import { TableSkeleton } from "@workspace/shared-lib/components/table-skeleton"
import { Button } from "@workspace/ui/components/button"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { RolesEmptyState } from "@/features/roles/components/roles-empty-state"
import { RolesErrorPanel } from "@/features/roles/components/roles-error-panel"
import { RolesPagination } from "@/features/roles/components/roles-pagination"
import { ROLE_COLUMN_WIDTHS } from "@/features/roles/utils/column-widths"
import { formatLocalDateTime } from "@/features/roles/utils"

const DEFAULT_PAGE_SIZE = 30

/**
 * Reference Refine table (ADR-0015): `useTable` from `@refinedev/react-table`
 * owns server pagination, sorting, and URL sync. Filters, row actions, and bulk
 * controls are intentionally absent here; later tickets add them around this
 * data layer without replacing it.
 */
export function RolesTable() {
  const { t } = useTranslation()
  const { data: canCreateRole } = useCan({
    resource: "roles",
    action: "create",
  })
  const canCreate = canCreateRole?.can === true

  const columns = useMemo<ColumnDef<RoleRecord>[]>(
    () => [
      {
        accessorKey: "title",
        header: t("roles.columns.title"),
        size: ROLE_COLUMN_WIDTHS.title,
      },
      {
        accessorKey: "description",
        header: t("roles.columns.description"),
        size: ROLE_COLUMN_WIDTHS.description,
        enableSorting: false,
        cell: ({ row }) => {
          const description = row.original.description
          if (!description) return null
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="block max-w-[320px] truncate">
                    {description}
                  </span>
                }
              />
              <TooltipContent>{description}</TooltipContent>
            </Tooltip>
          )
        },
      },
      {
        accessorKey: "status",
        header: t("roles.columns.status"),
        size: ROLE_COLUMN_WIDTHS.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status}>
            {t(`roles.status.${row.original.status}`)}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("roles.columns.createdAt"),
        size: ROLE_COLUMN_WIDTHS.createdAt,
        cell: ({ row }) => formatLocalDateTime(row.original.createdAt),
      },
      {
        accessorKey: "updatedAt",
        header: t("roles.columns.updatedAt"),
        size: ROLE_COLUMN_WIDTHS.updatedAt,
        cell: ({ row }) => formatLocalDateTime(row.original.updatedAt),
      },
    ],
    [t]
  )

  const {
    reactTable,
    refineCore: { tableQuery, pageCount, result },
  } = useTable<RoleRecord>({
    refineCoreProps: {
      resource: "roles",
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE, mode: "server" },
      sorters: { initial: [{ field: "updatedAt", order: "desc" }] },
      filters: { mode: "server" },
    },
    columns,
    getRowId: (row) => row.id,
    enableSortingRemoval: false,
  })

  const rows = reactTable.getRowModel().rows
  const { pageIndex, pageSize } = reactTable.getState().pagination
  const page = pageIndex + 1
  const total = result.total ?? 0
  const totalPages = Math.max(1, pageCount)

  const goToPage = (nextPage: number) => {
    reactTable.setPageIndex(Math.max(0, nextPage - 1))
  }

  const changePageSize = (nextPageSize: number) => {
    reactTable.setPageSize(nextPageSize)
    reactTable.setPageIndex(0)
  }

  return (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("roles.title")}</h1>
        {canCreate ? <Button type="button">{t("roles.create")}</Button> : null}
      </div>

      {tableQuery.isLoading ? (
        <TableSkeleton
          columnWidths={Object.values(ROLE_COLUMN_WIDTHS)}
          rowCount={pageSize}
          label={t("roles.loading")}
        />
      ) : tableQuery.isError ? (
        <RolesErrorPanel
          error={tableQuery.error}
          isRetrying={tableQuery.isFetching}
          onRetry={() => {
            void tableQuery.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <RolesEmptyState canCreate={canCreate} />
      ) : (
        <>
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                {reactTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortDirection = header.column.getIsSorted()
                      return (
                        <TableHead
                          key={header.id}
                          style={{ width: header.getSize() }}
                          aria-sort={
                            sortDirection === "asc"
                              ? "ascending"
                              : sortDirection === "desc"
                                ? "descending"
                                : header.column.getCanSort()
                                  ? "none"
                                  : undefined
                          }
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 text-left"
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {sortDirection === "asc" ? (
                                <ArrowUpIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              ) : sortDirection === "desc" ? (
                                <ArrowDownIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowUpDownIcon
                                  className="size-3 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <RolesPagination
            page={page}
            pageSize={pageSize}
            pageCount={totalPages}
            total={total}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        </>
      )}
    </div>
  )
}
