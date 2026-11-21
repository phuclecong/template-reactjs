import { memo, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ColumnDef, Row } from "@tanstack/react-table"
import type { TaskRecord } from "@workspace/api/schemas"
import {
  createSelectionColumn,
  TableShellView,
} from "@workspace/shared-lib/components"
import { useDialog, useTableShell } from "@workspace/shared-lib/hooks"
import { Button } from "@workspace/ui/components/button"
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

const getTaskRowId = (task: TaskRecord) => task.id

/**
 * Reference Refine table (ADR-0015) for Tasks, built on the shared table shell
 * (ticket #82). The shell owns `useTable`, the flat URL seed/mirror (ADR-0016),
 * server pagination, and page-scoped selection; this feature keeps its columns,
 * predicate selection, filter bar, bulk bar, and lazy form/delete overlays.
 */
export function TasksTable({ currentUser }: { currentUser: CurrentUser }) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)

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

  const columns = useMemo<ColumnDef<TaskRecord>[]>(() => {
    const selectColumn = createSelectionColumn<TaskRecord>({
      width: TASK_COLUMN_WIDTHS.select,
      selectAllLabel: t("tasks.selectAll"),
      selectRowLabel: (task) => t("tasks.selectRow", { title: task.title }),
    })

    return [
      selectColumn,
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
    ]
  }, [
    assigneeName,
    currentUser,
    deleteDialog.open,
    formDialog.open,
    locale,
    prefetchDeleteOverlay,
    prefetchFormOverlay,
    t,
  ])

  const enableRowSelection = useCallback(
    (row: Row<TaskRecord>) => canModifyTask(row.original, currentUser),
    [currentUser]
  )

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
  } = useTableShell<TaskRecord>({
    resource: "tasks",
    parseUrl: parseTasksUrlState,
    buildUrl: buildTasksSearchParams,
    columns,
    getRowId: getTaskRowId,
    enableRowSelection,
  })

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
          {selectedRows.length > 0 ? (
            <TasksBulkBar
              selectedTasks={selectedRows}
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

      <TableShellView
        table={reactTable}
        isLoading={tableQuery.isLoading}
        isError={tableQuery.isError}
        isRetrying={tableQuery.isFetching}
        onRetry={() => {
          void tableQuery.refetch()
        }}
        loadingLabel={t("tasks.loading")}
        skeletonColumnWidths={TASK_SKELETON_COLUMN_WIDTHS}
        skeletonRowCount={pageSize}
        errorTitle={t("tasks.error")}
        errorDescription={describeError(tableQuery.error)}
        retryLabel={t("tasks.retry")}
        empty={{
          title: hasActiveFilters ? t("tasks.emptyNoMatch") : t("tasks.empty"),
          action: hasActiveFilters
            ? undefined
            : {
                label: t("tasks.new"),
                onClick: () => formDialog.open(),
              },
        }}
        pagination={{
          page,
          pageSize,
          pageCount,
          summary: t("tasks.total", { total }),
          onPageChange: goToPage,
          onPageSizeChange: changePageSize,
        }}
      />

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
