import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCan, useDelete, type CrudFilter } from "@refinedev/core"
import { useTable } from "@refinedev/react-table"
import type { ColumnDef } from "@tanstack/react-table"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import type { RoleRecord } from "@workspace/api/schemas"
import {
  EmptyList,
  ErrorPanel,
  TableGrid,
  TablePagination,
} from "@workspace/shared-lib/components"
import { TableSkeleton } from "@workspace/shared-lib/components/table-skeleton"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import {
  RoleFormDrawer,
  type RoleFormDrawerHandle,
} from "@/features/roles/components/role-form-drawer"
import { RolesBulkBar } from "@/features/roles/components/roles-bulk-bar"
import { RolesFilterBar } from "@/features/roles/components/roles-filter-bar"
import {
  ROLE_COLUMN_WIDTHS,
  ROLE_SELECT_COLUMN_WIDTH,
} from "@/features/roles/utils/column-widths"
import { formatLocalDateTime, isSystemRole } from "@/features/roles/utils"
import {
  buildRolesSearchParams,
  parseRolesUrlState,
} from "@/features/roles/utils/url-state"
import { track } from "@/observability"
import { describeError } from "@/utils/http-error"

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
 * owns server pagination, sorting, and filtering. Refine's built-in URL sync is
 * off; a flat `URLSearchParams` adapter (ADR-0016) seeds and mirrors the table
 * state instead. Create and Edit route into the shared `RoleFormDrawer`.
 * Administrators also get a page-scoped selection column and the bulk bar;
 * Members get neither.
 */
export function RolesTable() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()
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
  // There is no "bulk" access-control action; bulk work is an Administrator
  // write gated by the same delete permission as the row actions.
  const { data: canBulkActionRole } = useCan({
    resource: "roles",
    action: "delete",
  })
  const canBulkAction = canBulkActionRole?.can === true

  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null)
  const deleteMutation = useDelete<RoleRecord>({})

  const columns = useMemo<ColumnDef<RoleRecord>[]>(() => {
    const selectColumn: ColumnDef<RoleRecord> = {
      id: "select",
      size: ROLE_SELECT_COLUMN_WIDTH,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(!!checked)
          }
          aria-label={t("roles.bulk.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(!!checked)}
          aria-label={t("roles.bulk.selectRow", {
            title: row.original.title,
          })}
        />
      ),
    }

    const dataColumns: ColumnDef<RoleRecord>[] = [
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
    ]

    // The selection column is always defined and visibility-gated per role.
    // Rebuilding the columns when access resolves would re-run Refine's filter
    // effect and reset a page restored from the URL.
    return [selectColumn, ...dataColumns]
  }, [t])

  // The URL seeds `useTable` on mount. It is re-parsed whenever the query
  // string changes so Refine's "empty search" reset sees the current defaults;
  // after that, table state is the source of truth and the effect below mirrors
  // it back into the URL.
  const urlState = useMemo(
    () => parseRolesUrlState(searchParams),
    [searchParams]
  )

  const { reactTable, refineCore } = useTable<RoleRecord>({
    refineCoreProps: {
      resource: "roles",
      // Refine's sync serializes `filters[0][value]` without encoding values.
      // The table owns its URL format instead (see `url-state.ts`).
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
    getRowId: (row) => row.id,
    enableSortingRemoval: false,
    enableRowSelection: canBulkAction,
    // Row actions and selection start hidden so members never see them.
    // Toggling visibility (rather than rebuilding the columns) keeps the
    // restored page intact.
    initialState: { columnVisibility: { actions: false, select: false } },
  })

  // Merge visibility rather than replace it: actions and selection are gated by
  // different permissions, so the two updates must not clobber each other.
  useEffect(() => {
    reactTable.setColumnVisibility((previous) => ({
      ...previous,
      actions: canEdit,
      select: canBulkAction,
    }))
  }, [reactTable, canEdit, canBulkAction])

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
    const next = buildRolesSearchParams(
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
  const totalPages = Math.max(1, pageCount)

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
  const locationSignature = JSON.stringify({
    filters,
    sorters,
    currentPage: refineCurrentPage,
    pageSize: refinePageSize,
  })
  const lastLocationSignature = useRef(locationSignature)
  useEffect(() => {
    if (lastLocationSignature.current === locationSignature) return
    lastLocationSignature.current = locationSignature
    reactTable.resetRowSelection()
  }, [locationSignature, reactTable])

  const selectedRoles = rows
    .filter((row) => rowSelection[row.id] === true)
    .map((row) => row.original)

  const goToPage = (nextPage: number) => {
    clearSelection()
    reactTable.setPageIndex(Math.max(0, nextPage - 1))
  }

  const changePageSize = (nextPageSize: number) => {
    clearSelection()
    reactTable.setPageSize(nextPageSize)
    reactTable.setPageIndex(0)
  }

  // Filter state is owned by Refine core and mirrored to the URL above. Any
  // change replaces the filters and returns to page 1; both pagination layers
  // are updated because Refine does not reset the page for `setFilters` on
  // its own.
  // `useCallback` keeps the filter bar's 300 ms debounce from re-arming every
  // time an unrelated table render produces a new callback identity.
  const changeFilters = useCallback(
    (nextFilters: CrudFilter[]) => {
      reactTable.resetRowSelection()
      setFilters(nextFilters, "replace")
      setCurrentPage(1)
      reactTable.setPageIndex(0)
    },
    [reactTable, setFilters, setCurrentPage]
  )

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
        <div className="flex items-center gap-2">
          {canCreate ? (
            <Button
              type="button"
              onClick={() => drawerRef.current?.openCreate()}
            >
              {t("roles.create")}
            </Button>
          ) : null}
          {canBulkAction && selectedRoles.length > 0 ? (
            <RolesBulkBar
              selectedRoles={selectedRoles}
              onDone={clearSelection}
            />
          ) : null}
        </div>
      </div>

      <RolesFilterBar filters={filters} onChange={changeFilters} />

      {tableQuery.isLoading ? (
        <TableSkeleton
          columnWidths={Object.values(ROLE_COLUMN_WIDTHS)}
          rowCount={pageSize}
          label={t("roles.loading")}
        />
      ) : tableQuery.isError ? (
        <ErrorPanel
          title={t("roles.error")}
          description={describeError(tableQuery.error)}
          retryLabel={t("roles.retry")}
          isRetrying={tableQuery.isFetching}
          onRetry={() => {
            void tableQuery.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyList
          title={t("roles.empty")}
          description={t("roles.emptyHint")}
          action={
            canCreate
              ? {
                  label: t("roles.create"),
                  onClick: () => drawerRef.current?.openCreate(),
                }
              : undefined
          }
        />
      ) : (
        <>
          <TableGrid table={reactTable} />

          <TablePagination
            page={page}
            pageSize={pageSize}
            pageCount={totalPages}
            summary={t("roles.total", { total })}
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
