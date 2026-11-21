import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useDelete,
  useInvalidate,
  useList,
  useSelect,
  type HttpError,
} from "@refinedev/core"
import type { ColumnDef } from "@tanstack/react-table"
import type { RoleRecord } from "@workspace/api/schemas"
import { DataTable } from "@workspace/shared-lib/components"
import { isAdministratorRole } from "@workspace/api/policy"
import { useDialog, useTableState } from "@workspace/shared-lib/hooks"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { UsersFilterBar } from "@/features/users/components/users-filter-bar"
import { toUserCrudFilters } from "@/features/users/utils"
import { USER_COLUMN_WIDTHS } from "@/features/users/utils/column-widths"
import type { CurrentUser, UserRow } from "@/features/users/utils"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

const FILTER_KEYS = ["roleId"] as const

/** Fetch every Role so the assignment control can offer the whole catalogue. */
const ROLE_PAGE_SIZE = 100

export function UsersTable({ currentUser }: { currentUser: CurrentUser }) {
  const { t } = useTranslation()

  const {
    q,
    searchValue,
    onSearchChange,
    filterValues,
    sorters,
    sorting,
    onSortingChange,
    page,
    pageSize,
    rowSelection,
    setRowSelection,
    updateParams,
  } = useTableState({ defaultSortField: "name", filterKeys: FILTER_KEYS })

  const roleId = filterValues.roleId
  const hasActiveFilters = Boolean(q || roleId)
  const filters = useMemo(() => toUserCrudFilters(q, { roleId }), [q, roleId])

  // Role options come from the Roles resource, not a hard-coded enum.
  const roleSelect = useSelect<RoleRecord>({
    resource: "roles",
    pagination: {
      currentPage: 1,
      pageSize: ROLE_PAGE_SIZE,
      mode: "server",
    },
    sorters: [{ field: "title", order: "asc" }],
  })
  const roleRecords = useMemo(
    () => roleSelect.query.data?.data ?? [],
    [roleSelect.query.data]
  )
  const roleOptions = useMemo(
    () => roleRecords.map((role) => ({ value: role.id, label: role.title })),
    [roleRecords]
  )
  const roleById = useMemo(
    () => new Map(roleRecords.map((role) => [role.id, role])),
    [roleRecords]
  )

  const usersQuery = useList<UserRow>({
    resource: "users",
    pagination: { currentPage: page, pageSize },
    sorters,
    filters,
  })
  const users = usersQuery.result.data ?? []
  const total = usersQuery.result.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const invalidate = useInvalidate()
  const roleMutation = useCustomMutation<
    UserRow,
    HttpError,
    { roleId: string }
  >({})
  const deleteMutation = useDelete<UserRow>({})

  const deleteDialog = useDialog<UserRow>()
  // Bind `open` to a stable local so the `columns` memo below can depend on it
  // (a `useCallback`) rather than on the fresh `deleteDialog` object.
  const openDelete = deleteDialog.open

  const isAdmin = isAdministratorRole(currentUser.roleId)

  const changeRole = useCallback(
    (user: UserRow, nextRoleId: string) => {
      if (nextRoleId === user.roleId) return
      roleMutation.mutate(
        {
          url: `${apiUrl}/users/${user.id}/role`,
          method: "patch",
          values: { roleId: nextRoleId },
          successNotification: {
            message: t("users.roleUpdated"),
            type: "success",
          },
          errorNotification: (error) => ({
            message: t("users.failedRoleUpdate"),
            type: "error",
            description: describeError(error),
          }),
        },
        {
          onSuccess: () => {
            void invalidate({ resource: "users", invalidates: ["list"] })
          },
        }
      )
    },
    [roleMutation, invalidate, t]
  )

  const confirmDelete = useCallback(() => {
    if (!deleteDialog.data) return
    deleteMutation.mutate(
      {
        resource: "users",
        id: deleteDialog.data.id,
        successNotification: { message: t("users.deleted"), type: "success" },
        errorNotification: (error) => ({
          message: t("users.failedDelete"),
          type: "error",
          description: describeError(error),
        }),
      },
      { onSuccess: deleteDialog.close }
    )
  }, [deleteDialog.data, deleteDialog.close, deleteMutation, t])

  const columns = useMemo<ColumnDef<UserRow>[]>(() => {
    const cols: ColumnDef<UserRow>[] = [
      {
        accessorKey: "name",
        header: t("users.columns.name"),
        size: USER_COLUMN_WIDTHS.name,
      },
      {
        accessorKey: "email",
        header: t("users.columns.email"),
        size: USER_COLUMN_WIDTHS.email,
      },
      {
        accessorKey: "roleId",
        header: t("users.columns.role"),
        size: USER_COLUMN_WIDTHS.role,
        cell: ({ row }) => {
          const user = row.original
          if (!isAdmin) return user.role.title
          return (
            <Select
              value={user.roleId}
              onValueChange={(value) => {
                if (typeof value === "string") changeRole(user, value)
              }}
            >
              <SelectTrigger
                aria-label={t("users.roleLabel", { name: user.name })}
              >
                <SelectValue>
                  {(value: string | null) =>
                    (value ? roleById.get(value)?.title : null) ??
                    user.role.title
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roleRecords.map((role) => (
                  <SelectItem
                    key={role.id}
                    value={role.id}
                    // Inactive Roles stay visible for the User who already
                    // holds one but are unavailable for a new assignment.
                    disabled={
                      role.status === "inactive" && role.id !== user.roleId
                    }
                  >
                    {role.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      },
    ]

    if (isAdmin) {
      cols.push({
        id: "actions",
        header: t("users.columns.actions"),
        size: USER_COLUMN_WIDTHS.actions,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => openDelete(row.original)}
          >
            {t("users.delete")}
          </Button>
        ),
      })
    }

    return cols
  }, [t, isAdmin, changeRole, openDelete, roleRecords, roleById])

  return (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <UsersFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        roleId={roleId}
        roleOptions={roleOptions}
        onRoleChange={(value) => updateParams({ roleId: value, page: "" })}
        onClear={() =>
          updateParams({
            q: "",
            roleId: "",
          })
        }
      />

      <DataTable
        data={users}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        onSortingChange={onSortingChange}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        enableRowSelection={() => false}
        isLoading={usersQuery.query.isLoading}
        loadingLabel={t("users.loading")}
        emptyLabel={
          hasActiveFilters ? t("users.emptyNoMatch") : t("users.empty")
        }
        pagination={{
          page,
          pageSize,
          pageCount,
          onPageChange: (next) => updateParams({ page: String(next) }),
          onPageSizeChange: (next) =>
            updateParams({ pageSize: String(next), page: "" }),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        title={t("users.deleteTitle")}
        description={t("users.deleteBody", {
          name: deleteDialog.data?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loading={deleteMutation.mutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
