import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCan, useDelete, type CrudFilter } from "@refinedev/core"
import { useTable } from "@refinedev/react-table"
import { flexRender, type ColumnDef } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import type { RoleRecord } from "@workspace/api/schemas"
import { TableSkeleton } from "@workspace/shared-lib/components/table-skeleton"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
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

import {
  RoleFormDrawer,
  type RoleFormDrawerHandle,
} from "@/features/roles/components/role-form-drawer"
import { RolesEmptyState } from "@/features/roles/components/roles-empty-state"
import { RolesErrorPanel } from "@/features/roles/components/roles-error-panel"
import { RolesFilterBar } from "@/features/roles/components/roles-filter-bar"
import { RolesPagination } from "@/features/roles/components/roles-pagination"
import { ROLE_COLUMN_WIDTHS } from "@/features/roles/utils/column-widths"
import { formatLocalDateTime, isSystemRole } from "@/features/roles/utils"
import { track } from "@/observability"
import { describeError } from "@/utils/http-error"

const DEFAULT_PAGE_SIZE = 30

/**
 * The Delete action owns its access check so the `columns` memo stays stable
 * and access-independent: changing its identity after mount would reset the
 * restored pagination. System Roles are excluded by the caller; the server
 * enforces the same rule.
 */
function RoleDeleteAction({
  role,
  label,
  onDelete,
}: {
  role: RoleRecord
  label: string
  onDelete: (role: RoleRecord) => void
}) {
  const { data: canDelete } = useCan({ resource: "roles", action: "delete" })
  if (canDelete?.can !== true) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onDelete(role)}
    >
      {label}
    </Button>
  )
}

/**
 * Reference Refine table (ADR-0015): `useTable` from `@refinedev/react-table`
 * owns server pagination, sorting, and URL sync. Create and Edit route into the
 * shared `RoleFormDrawer`; filters and bulk controls belong to later tickets
 * around this data layer.
 */
export function RolesTable() {
  const { t } = useTranslation()
  const drawerRef = useRef<RoleFormDrawerHandle>(null)
  const { data: canCreateRole } = useCan({
    resource: "roles",
    action: "create",
  })
  const { data: canEditRole } = useCan({
    resource: "roles",
    action: "edit",
  })
  const canCreate = canCreateRole?.can === true
  const canEdit = canEditRole?.can === true

  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null)
  const deleteMutation = useDelete<RoleRecord>({})

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
      {
        id: "actions",
        header: t("roles.actions"),
        size: ROLE_COLUMN_WIDTHS.actions,
        enableSorting: false,
        enableHiding: true,
        cell: ({ row }) => {
          const role = row.original
          return (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => drawerRef.current?.openEdit(role.id)}
              >
                {t("roles.edit")}
              </Button>
              {!isSystemRole(role.id) ? (
                <RoleDeleteAction
                  role={role}
                  label={t("roles.delete")}
                  onDelete={setDeleteTarget}
                />
              ) : null}
            </div>
          )
        },
      },
    ],
    [t]
  )

  const { reactTable, refineCore } = useTable<RoleRecord>({
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
    // Row actions start hidden so members never see them. Toggling visibility
    // (rather than rebuilding the columns) keeps the restored page intact.
    initialState: { columnVisibility: { actions: false } },
  })

  useEffect(() => {
    reactTable.setColumnVisibility({ actions: canEdit })
  }, [reactTable, canEdit])

  const { tableQuery, pageCount, result, filters, setFilters, setCurrentPage } =
    refineCore

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

  // Filter state is owned by Refine core so it syncs to the URL. Any change
  // replaces the filters and returns to page 1; both pagination layers are
  // updated because Refine does not reset the page for `setFilters` on its own.
  const changeFilters = (nextFilters: CrudFilter[]) => {
    setFilters(nextFilters, "replace")
    setCurrentPage(1)
    reactTable.setPageIndex(0)
  }

  // Single-row delete: confirm in the name of the Role, then let Refine surface
  // success/error notifications and invalidate the list. System Roles and
  // referenced Roles are rejected server-side; the row stays put on error.
  const confirmDelete = () => {
    if (!deleteTarget) return
    const roleId = deleteTarget.id
    deleteMutation.mutate(
      {
        resource: "roles",
        id: roleId,
        invalidates: ["list"],
        successNotification: { message: t("roles.deleted"), type: "success" },
        errorNotification: (error) => ({
          message: t("roles.deleteFailed"),
          type: "error",
          description: describeError(error),
        }),
      },
      {
        onSuccess: () => {
          track("role.deleted", { roleId })
          setDeleteTarget(null)
        },
        onError: () => setDeleteTarget(null),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("roles.title")}</h1>
        {canCreate ? (
          <Button
            type="button"
            onClick={() => drawerRef.current?.openCreate()}
          >
            {t("roles.create")}
          </Button>
        ) : null}
      </div>

      <RolesFilterBar filters={filters} onChange={changeFilters} />

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
        <RolesEmptyState
          canCreate={canCreate}
          onCreate={() => drawerRef.current?.openCreate()}
        />
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

      <RoleFormDrawer ref={drawerRef} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("roles.deleteTitle")}
        description={t("roles.deleteBody", {
          title: deleteTarget?.title ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loading={deleteMutation.mutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
