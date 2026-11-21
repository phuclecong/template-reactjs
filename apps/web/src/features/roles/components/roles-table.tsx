import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCan, useDelete } from "@refinedev/core"
import type { ColumnDef } from "@tanstack/react-table"
import { isSystemRole } from "@workspace/api/policy"
import type { RoleRecord } from "@workspace/api/schemas"
import {
  createSelectionColumn,
  TablePageLayout,
  TableShellView,
} from "@workspace/shared-lib/components"
import { useTableShell } from "@workspace/shared-lib/hooks"
import { Button } from "@workspace/ui/components/button"
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
  ROLE_SKELETON_COLUMN_WIDTHS,
} from "@/features/roles/utils/column-widths"
import { formatLocalDateTime } from "@/features/roles/utils"
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

const getRoleRowId = (role: RoleRecord) => role.id

/**
 * Reference Refine table (ADR-0015) for Roles, built on the shared table shell
 * (ticket #82). The shell owns `useTable`, the flat URL seed/mirror (ADR-0016),
 * server pagination, and page-scoped selection; this feature keeps its columns,
 * filter bar, bulk bar, drawer, and confirm delete. Create and Edit route into
 * the shared `RoleFormDrawer`. Administrators also get a page-scoped selection
 * column and the bulk bar; Members get neither.
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
    const selectColumn = createSelectionColumn<RoleRecord>({
      width: ROLE_SELECT_COLUMN_WIDTH,
      selectAllLabel: t("roles.bulk.selectAll"),
      selectRowLabel: (role) =>
        t("roles.bulk.selectRow", { title: role.title }),
    })

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

  const {
    reactTable,
    filters,
    tableQuery,
    page,
    pageSize,
    pageCount,
    total,
    selectedRows,
    clearSelection,
    goToPage,
    changePageSize,
    changeFilters,
  } = useTableShell<RoleRecord>({
    resource: "roles",
    parseUrl: parseRolesUrlState,
    buildUrl: buildRolesSearchParams,
    columns,
    getRowId: getRoleRowId,
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
    <TablePageLayout>
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
          {canBulkAction && selectedRows.length > 0 ? (
            <RolesBulkBar
              selectedRoles={selectedRows}
              onDone={clearSelection}
            />
          ) : null}
        </div>
      </div>

      <RolesFilterBar filters={filters} onChange={changeFilters} />

      <TableShellView
        table={reactTable}
        isLoading={tableQuery.isLoading}
        isError={tableQuery.isError}
        isRetrying={tableQuery.isFetching}
        onRetry={() => {
          void tableQuery.refetch()
        }}
        loadingLabel={t("roles.loading")}
        skeletonColumnWidths={ROLE_SKELETON_COLUMN_WIDTHS}
        skeletonRowCount={pageSize}
        errorTitle={t("roles.error")}
        errorDescription={describeError(tableQuery.error)}
        retryLabel={t("roles.retry")}
        empty={{
          title: t("roles.empty"),
          description: t("roles.emptyHint"),
          action: canCreate
            ? {
                label: t("roles.create"),
                onClick: () => drawerRef.current?.openCreate(),
              }
            : undefined,
        }}
        pagination={{
          page,
          pageSize,
          pageCount,
          summary: t("roles.total", { total }),
          onPageChange: goToPage,
          onPageSizeChange: changePageSize,
        }}
      />

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
    </TablePageLayout>
  )
}
