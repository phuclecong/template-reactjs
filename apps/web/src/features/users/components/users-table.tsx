import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useDelete,
  useInvalidate,
  useSelect,
  type HttpError,
} from "@refinedev/core"
import type { ColumnDef } from "@tanstack/react-table"
import { isAdministratorRole } from "@workspace/api/policy"
import type { RoleRecord } from "@workspace/api/schemas"
import {
  TablePageLayout,
  TableShellView,
} from "@workspace/shared-lib/components"
import { useDialog, useTableShell } from "@workspace/shared-lib/hooks"
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

const getUserRowId = (user: UserRow) => user.id

/**
 * The fetched Role catalogue the assignment cell reads. It is supplied through
 * context rather than captured by the `columns` memo: rebuilding the columns
 * when Roles resolve would re-run Refine's filter effect and reset a page
 * restored from the URL.
 */
type RoleCatalogue = {
  records: readonly RoleRecord[]
  byId: ReadonlyMap<string, RoleRecord>
}

const EMPTY_ROLE_CATALOGUE: RoleCatalogue = { records: [], byId: new Map() }

const RoleCatalogueContext = createContext<RoleCatalogue>(EMPTY_ROLE_CATALOGUE)

/**
 * The Role assignment control. It reads the fetched catalogue from context, so
 * the columns stay stable while the Roles list loads, and Members keep the
 * read-only Role title.
 */
function RoleCell({
  user,
  isAdmin,
  onChangeRole,
}: {
  user: UserRow
  isAdmin: boolean
  onChangeRole: (user: UserRow, roleId: string) => void
}) {
  const { t } = useTranslation()
  const roleCatalogue = useContext(RoleCatalogueContext)

  if (!isAdmin) return user.role.title

  return (
    <Select
      value={user.roleId}
      onValueChange={(value) => {
        if (typeof value === "string") onChangeRole(user, value)
      }}
    >
      <SelectTrigger aria-label={t("users.roleLabel", { name: user.name })}>
        <SelectValue>
          {(value: string | null) =>
            (value ? roleCatalogue.byId.get(value)?.title : null) ??
            user.role.title
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roleCatalogue.records.map((role) => (
          <SelectItem
            key={role.id}
            value={role.id}
            // Inactive Roles stay visible for the User who already holds one
            // but are unavailable for a new assignment.
            disabled={role.status === "inactive" && role.id !== user.roleId}
          >
            {role.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Reference Refine table (ADR-0015) for Users, built on the shared table shell
 * (ticket #82). The shell owns `useTable`, the flat URL seed/mirror (ADR-0016),
 * server pagination, and the page/total trio; this feature keeps the Role
 * catalogue context, debounced search, member read-only rendering, and delete.
 */
export function UsersTable({ currentUser }: { currentUser: CurrentUser }) {
  const { t } = useTranslation()

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
  const roleCatalogue = useMemo<RoleCatalogue>(
    () => ({ records: roleRecords, byId: roleById }),
    [roleRecords, roleById]
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
        cell: ({ row }) => (
          <RoleCell
            user={row.original}
            isAdmin={isAdmin}
            onChangeRole={changeRole}
          />
        ),
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
  }, [t, isAdmin, changeRole, openDelete])

  const {
    reactTable,
    filters,
    tableQuery,
    page,
    pageSize,
    pageCount,
    total,
    stateKey,
    goToPage,
    changePageSize,
    changeFilters,
  } = useTableShell<UserRow>({
    resource: "users",
    parseUrl: parseUsersUrlState,
    buildUrl: buildUsersSearchParams,
    columns,
    getRowId: getUserRowId,
  })

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

  // The search commits from inside the change handler, not an effect: the
  // timer is state the handler owns, and it is cleared on unmount and whenever
  // the committed query changes from outside the input (Clear, back/forward).
  const searchTimerRef = useRef<number | null>(null)
  const cancelPendingSearch = useCallback(() => {
    if (searchTimerRef.current === null) return
    window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = null
  }, [])
  useEffect(() => cancelPendingSearch, [cancelPendingSearch])
  useEffect(() => {
    cancelPendingSearch()
  }, [filterValues.q, cancelPendingSearch])

  const changeSearch = useCallback(
    (value: string) => {
      setSearchValue(value)
      cancelPendingSearch()
      if (value === filterValues.q) return
      searchTimerRef.current = window.setTimeout(() => {
        searchTimerRef.current = null
        changeFilters(
          userFiltersToCrud({ q: value, roleId: filterValues.roleId })
        )
      }, SEARCH_DEBOUNCE_MS)
    },
    [cancelPendingSearch, changeFilters, filterValues.q, filterValues.roleId]
  )

  // Selecting a Role commits any pending search text too, so a keystroke whose
  // debounce has not fired is never dropped.
  const changeRoleFilter = useCallback(
    (roleId: string) => {
      cancelPendingSearch()
      changeFilters(userFiltersToCrud({ q: searchValue, roleId }))
    },
    [cancelPendingSearch, changeFilters, searchValue]
  )

  const clearFilters = useCallback(() => {
    cancelPendingSearch()
    setSearchValue("")
    changeFilters([])
  }, [cancelPendingSearch, changeFilters])

  return (
    <RoleCatalogueContext.Provider value={roleCatalogue}>
      <TablePageLayout>
        <UsersFilterBar
          searchValue={searchValue}
          onSearchChange={changeSearch}
          roleId={filterValues.roleId}
          roleOptions={roleOptions}
          onRoleChange={changeRoleFilter}
          onClear={clearFilters}
        />

        <TableShellView
          table={reactTable}
          scrollResetKey={stateKey}
          isLoading={tableQuery.isLoading}
          isError={tableQuery.isError}
          isRetrying={tableQuery.isFetching}
          onRetry={() => {
            void tableQuery.refetch()
          }}
          loadingLabel={t("users.loading")}
          skeletonColumnWidths={USER_SKELETON_COLUMN_WIDTHS}
          skeletonRowCount={pageSize}
          errorTitle={t("users.error")}
          errorDescription={describeError(tableQuery.error)}
          retryLabel={t("users.retry")}
          empty={{
            title: hasActiveFilters
              ? t("users.emptyNoMatch")
              : t("users.empty"),
          }}
          pagination={{
            page,
            pageSize,
            pageCount,
            summary: t("users.total", { total }),
            onPageChange: goToPage,
            onPageSizeChange: changePageSize,
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
      </TablePageLayout>
    </RoleCatalogueContext.Provider>
  )
}
