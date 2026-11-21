import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import type { CrudFilter } from "@refinedev/core"
import { useTable } from "@refinedev/react-table"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import type { TaskRecord } from "@workspace/api/schemas"
import {
  EmptyList,
  ErrorPanel,
  TableGrid,
  TablePagination,
} from "@workspace/shared-lib/components"
import { TableSkeleton } from "@workspace/shared-lib/components/table-skeleton"
import { useDialog } from "@workspace/shared-lib/hooks"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatDateTime, resolveLocale } from "@workspace/ui/lib/date"

import { RetryableLazy } from "@/components/retryable-lazy"
import { TasksBulkBar } from "@/features/tasks/components/tasks-bulk-bar"
import { TasksFilterBar } from "@/features/tasks/components/tasks-filter-bar"
import {
  prefetchTaskOverlay,
  taskOverlayLoaders,
} from "@/features/tasks/components/tasks-overlay-loaders"
import {
  canModifyTask,
  useTaskRows,
} from "@/features/tasks/hooks/use-task-rows"
import {
  TASK_COLUMN_WIDTHS,
  TASK_SKELETON_COLUMN_WIDTHS,
} from "@/features/tasks/utils/column-widths"
import {
  buildTasksSearchParams,
  parseTasksUrlState,
} from "@/features/tasks/utils/url-state"
import type { CurrentUser } from "@/features/users/utils"
import { useIntentPrefetch } from "@/hooks/use-intent-prefetch"
import { describeError } from "@/utils/http-error"

/**
 * Memoized actions cell. `task` (the row object) and the stable callbacks let
 * `React.memo` skip re-rendering these buttons when the table re-renders for
 * selection or pagination changes. `useIntentPrefetch` keeps the spreadable
 * handlers stable for the same reason.
 */
const TaskActionsCell = memo(function TaskActionsCell({
  task,
  canModify,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
  onPrefetchEdit,
  onPrefetchDelete,
}: {
  task: TaskRecord
  canModify: boolean
  editLabel: string
  deleteLabel: string
  onEdit: (task: TaskRecord) => void
  onDelete: (task: TaskRecord) => void
  onPrefetchEdit: () => void
  onPrefetchDelete: () => void
}) {
  const editIntentHandlers = useIntentPrefetch(onPrefetchEdit)
  const deleteIntentHandlers = useIntentPrefetch(onPrefetchDelete)

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={!canModify}
        onClick={() => onEdit(task)}
        {...editIntentHandlers}
      >
        {editLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={!canModify}
        onClick={() => onDelete(task)}
        {...deleteIntentHandlers}
      >
        {deleteLabel}
      </Button>
    </div>
  )
})

/**
 * Reference Refine table (ADR-0015) for Tasks: `useTable` owns server
 * pagination, sorting, and filtering, the flat URL adapter (ADR-0016) seeds
 * and mirrors that state, and the form/delete overlays stay code-split.
 */
export function TasksTable({ currentUser }: { currentUser: CurrentUser }) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()

  const { users, assigneeName } = useTaskRows()
  const formDialog = useDialog<TaskRecord>()
  const deleteDialog = useDialog<TaskRecord>()

  // `version > 0` keeps the drawer mounted after its first open so Base UI can
  // run the slide-out transition. `close()` clears `data`, so remember the
  // last opened session's task (including a null create session) and render
  // that while the drawer animates out instead of flickering to create mode.
  const [sessionTask, setSessionTask] = useState<TaskRecord | null>(null)
  if (formDialog.isOpen && formDialog.data !== sessionTask) {
    setSessionTask(formDialog.data)
  }
  const formTask = formDialog.isOpen ? formDialog.data : sessionTask

  const prefetchFormOverlay = useCallback(() => {
    void prefetchTaskOverlay("form")
  }, [])
  const prefetchDeleteOverlay = useCallback(() => {
    void prefetchTaskOverlay("delete")
  }, [])
  const formIntentHandlers = useIntentPrefetch(prefetchFormOverlay)

  const columns = useMemo<ColumnDef<TaskRecord>[]>(
    () => [
      {
        id: "select",
        size: TASK_COLUMN_WIDTHS.select,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={
              table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected()
            }
            disabled={
              !table.getRowModel().rows.some((row) => row.getCanSelect())
            }
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(!!checked)
            }
            aria-label={t("tasks.selectAll")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(checked) => row.toggleSelected(!!checked)}
            aria-label={t("tasks.selectRow", { title: row.original.title })}
          />
        ),
      },
      {
        accessorKey: "title",
        header: t("tasks.columns.title"),
        size: TASK_COLUMN_WIDTHS.title,
      },
      {
        accessorKey: "status",
        header: t("tasks.columns.status"),
        size: TASK_COLUMN_WIDTHS.status,
        cell: ({ row }) => t(`tasks.status.${row.original.status}`),
      },
      {
        accessorKey: "priority",
        header: t("tasks.columns.priority"),
        size: TASK_COLUMN_WIDTHS.priority,
        cell: ({ row }) =>
          row.original.priority
            ? t(`tasks.priority.${row.original.priority}`)
            : "",
      },
      {
        id: "assignee",
        header: t("tasks.columns.assignee"),
        size: TASK_COLUMN_WIDTHS.assignee,
        enableSorting: false,
        cell: ({ row }) => assigneeName(row.original.assigneeId),
      },
      {
        accessorKey: "dueDate",
        header: t("tasks.columns.dueDate"),
        size: TASK_COLUMN_WIDTHS.dueDate,
        cell: ({ row }) =>
          row.original.dueDate
            ? formatDateTime(row.original.dueDate, locale)
            : "",
      },
      {
        id: "actions",
        header: t("tasks.columns.actions"),
        size: TASK_COLUMN_WIDTHS.actions,
        enableSorting: false,
        cell: ({ row }) => (
          <TaskActionsCell
            task={row.original}
            canModify={canModifyTask(row.original, currentUser)}
            editLabel={t("tasks.edit")}
            deleteLabel={t("common.delete")}
            onEdit={formDialog.open}
            onDelete={deleteDialog.open}
            onPrefetchEdit={prefetchFormOverlay}
            onPrefetchDelete={prefetchDeleteOverlay}
          />
        ),
      },
    ],
    [
      assigneeName,
      currentUser,
      deleteDialog.open,
      formDialog.open,
      locale,
      prefetchDeleteOverlay,
      prefetchFormOverlay,
      t,
    ]
  )

  const enableRowSelection = useCallback(
    (row: Row<TaskRecord>) => canModifyTask(row.original, currentUser),
    [currentUser]
  )

  // The URL seeds `useTable` on mount; the effect below mirrors state back.
  const urlState = useMemo(
    () => parseTasksUrlState(searchParams),
    [searchParams]
  )

  const { reactTable, refineCore } = useTable<TaskRecord>({
    refineCoreProps: {
      resource: "tasks",
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
    enableRowSelection,
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
    const next = buildTasksSearchParams(
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

  const rowSelection = reactTable.getState().rowSelection
  const clearSelection = useCallback(() => {
    reactTable.resetRowSelection()
  }, [reactTable])

  // State-driven reset: a reload from a shared URL or an action that changes
  // rows outside the handlers below must not leave a selection behind.
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

  const selectedTasks = rows
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

  // Any filter change replaces the state and returns to page 1; both
  // pagination layers are updated because Refine does not reset the page for
  // `setFilters` on its own. The debounce in the bar needs a stable identity.
  const changeFilters = useCallback(
    (nextFilters: CrudFilter[]) => {
      reactTable.resetRowSelection()
      setFilters(nextFilters, "replace")
      setCurrentPage(1)
      reactTable.setPageIndex(0)
    },
    [reactTable, setFilters, setCurrentPage]
  )

  const hasActiveFilters = filters.length > 0

  return (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("tasks.title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => formDialog.open()}
            {...formIntentHandlers}
          >
            {t("tasks.new")}
          </Button>
          {selectedTasks.length > 0 ? (
            <TasksBulkBar
              selectedTasks={selectedTasks}
              users={users}
              onDone={clearSelection}
            />
          ) : null}
        </div>
      </div>

      <TasksFilterBar
        filters={filters}
        users={users}
        onChange={changeFilters}
      />

      {tableQuery.isLoading ? (
        <TableSkeleton
          columnWidths={TASK_SKELETON_COLUMN_WIDTHS}
          rowCount={pageSize}
          label={t("tasks.loading")}
        />
      ) : tableQuery.isError ? (
        <ErrorPanel
          title={t("tasks.error")}
          description={describeError(tableQuery.error)}
          retryLabel={t("tasks.retry")}
          isRetrying={tableQuery.isFetching}
          onRetry={() => {
            void tableQuery.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyList
          title={hasActiveFilters ? t("tasks.emptyNoMatch") : t("tasks.empty")}
          action={
            hasActiveFilters
              ? undefined
              : {
                  label: t("tasks.new"),
                  onClick: () => formDialog.open(),
                }
          }
        />
      ) : (
        <>
          <TableGrid table={reactTable} />

          <TablePagination
            page={page}
            pageSize={pageSize}
            pageCount={totalPages}
            summary={t("tasks.total", { total })}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        </>
      )}

      {formDialog.version > 0 ? (
        <RetryableLazy
          key={formDialog.version}
          loader={taskOverlayLoaders.form}
          props={{
            open: formDialog.isOpen,
            task: formTask,
            users,
            onClose: formDialog.close,
          }}
        />
      ) : null}
      {deleteDialog.isOpen ? (
        <RetryableLazy
          key={deleteDialog.version}
          loader={taskOverlayLoaders.delete}
          props={{
            open: deleteDialog.isOpen,
            task: deleteDialog.data,
            onClose: deleteDialog.close,
          }}
        />
      ) : null}
    </div>
  )
}
