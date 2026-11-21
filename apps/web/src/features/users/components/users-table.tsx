import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useDelete,
  useInvalidate,
  useSelect,
  type CrudFilter,
  type HttpError,
} from "@refinedev/core"
import { useTable } from "@refinedev/react-table"
import type { ColumnDef } from "@tanstack/react-table"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { isAdministratorRole } from "@workspace/api/policy"
import type { RoleRecord } from "@workspace/api/schemas"
import {
  EmptyList,
  ErrorPanel,
  TableGrid,
  TablePagination,
} from "@workspace/shared-lib/components"
import { TableSkeleton } from "@workspace/shared-lib/components/table-skeleton"
import { useDialog } from "@workspace/shared-lib/hooks"
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
import {
  USER_COLUMN_WIDTHS,
  USER_SKELETON_COLUMN_WIDTHS,
} from "@/features/users/utils/column-widths"
import type { CurrentUser, UserRow } from "@/features/users/utils"
import {
  buildUsersSearchParams,
  parseUsersUrlState,
  userFiltersFromCrud,
  userFiltersToCrud,
} from "@/features/users/utils/url-state"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

/** The search box commits after the user pauses for this long. */
const SEARCH_DEBOUNCE_MS = 300

/** Fetch every Role so the assignment control can offer the whole catalogue. */
const ROLE_PAGE_SIZE = 100

/**
 * Reference Refine table (ADR-0015) for Users: `useTable` owns server
 * pagination, sorting, and filtering, seeded and mirrored through the flat URL
 * adapter (ADR-0016). The filter bar keeps its scalar props; the table
 * translates them to and from Refine's `CrudFilter[]` internally.
 */
export function UsersTable({ currentUser }: { currentUser: CurrentUser }) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()

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

  const invalidate = useInvalidate()
  const roleMutation = useCustomMutation<
    UserRow,
    HttpError,
    { roleId: string }
  >({})
  // Bind the stable mutation function so `changeRole` (and therefore the
  // `columns` memo) keeps its identity across renders.
  const mutateRole = roleMutation.mutate
  const deleteMutation = useDelete<UserRow>({})

  const deleteDialog = useDialog<UserRow>()
  // Bind `open` to a stable local so the `columns` memo below can depend on it
  // (a `useCallback`) rather than on the fresh `deleteDialog` object.
  const openDelete = deleteDialog.open

  const isAdmin = isAdministratorRole(currentUser.roleId)

  const changeRole = useCallback(
    (user: UserRow, nextRoleId: string) => {
      if (nextRoleId === user.roleId) return
      mutateRole(
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
    [mutateRole, invalidate, t]
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

  // The URL seeds `useTable` on mount. It is re-parsed whenever the query
  // string changes so Refine's "empty search" reset sees the current defaults;
  // after that, table state is the source of truth and the effect below mirrors
  // it back into the URL.
  const urlState = useMemo(
    () => parseUsersUrlState(searchParams),
    [searchParams]
  )

  const { reactTable, refineCore } = useTable<UserRow>({
    refineCoreProps: {
      resource: "users",
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
  // with flat, encoded keys, skipping the write when the URL already matches.
  useEffect(() => {
    const next = buildUsersSearchParams(
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

  const filterValues = useMemo(() => userFiltersFromCrud(filters), [filters])
  const hasActiveFilters = Boolean(filterValues.q || filterValues.roleId)

  // The search box is locally controlled for typing feel. An external change
  // (Clear, browser back/forward) is applied during render from the previous
  // committed value, so the input tracks the URL without an extra effect.
  const [searchValue, setSearchValue] = useState(filterValues.q)
  const [lastCommittedQuery, setLastCommittedQuery] = useState(filterValues.q)
  if (filterValues.q !== lastCommittedQuery) {
    setLastCommittedQuery(filterValues.q)
    setSearchValue(filterValues.q)
  }

  // Any filter change replaces the state and returns to page 1; both
  // pagination layers are updated because Refine does not reset the page for
  // `setFilters` on its own. `useCallback` keeps the debounce from re-arming
  // on unrelated table renders.
  const changeFilters = useCallback(
    (nextFilters: CrudFilter[]) => {
      setFilters(nextFilters, "replace")
      setCurrentPage(1)
      reactTable.setPageIndex(0)
    },
    [reactTable, setFilters, setCurrentPage]
  )

  useEffect(() => {
    if (searchValue === filterValues.q) return
    const timer = window.setTimeout(() => {
      changeFilters(
        userFiltersToCrud({ q: searchValue, roleId: filterValues.roleId })
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchValue, filterValues.q, filterValues.roleId, changeFilters])

  // Selecting a Role commits any pending search text too, so a keystroke whose
  // debounce has not fired is never dropped.
  const changeRoleFilter = useCallback(
    (roleId: string) => {
      changeFilters(userFiltersToCrud({ q: searchValue, roleId }))
    },
    [changeFilters, searchValue]
  )

  const clearFilters = useCallback(() => {
    setSearchValue("")
    changeFilters([])
  }, [changeFilters])

  const goToPage = (nextPage: number) => {
    reactTable.setPageIndex(Math.max(0, nextPage - 1))
  }

  const changePageSize = (nextPageSize: number) => {
    reactTable.setPageSize(nextPageSize)
    reactTable.setPageIndex(0)
  }

  return (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <UsersFilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        roleId={filterValues.roleId}
        roleOptions={roleOptions}
        onRoleChange={changeRoleFilter}
        onClear={clearFilters}
      />

      {tableQuery.isLoading ? (
        <TableSkeleton
          columnWidths={USER_SKELETON_COLUMN_WIDTHS}
          rowCount={pageSize}
          label={t("users.loading")}
        />
      ) : tableQuery.isError ? (
        <ErrorPanel
          title={t("users.error")}
          description={describeError(tableQuery.error)}
          retryLabel={t("users.retry")}
          isRetrying={tableQuery.isFetching}
          onRetry={() => {
            void tableQuery.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyList
          title={hasActiveFilters ? t("users.emptyNoMatch") : t("users.empty")}
        />
      ) : (
        <>
          <TableGrid table={reactTable} />

          <TablePagination
            page={page}
            pageSize={pageSize}
            pageCount={totalPages}
            summary={t("users.total", { total })}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        </>
      )}

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
