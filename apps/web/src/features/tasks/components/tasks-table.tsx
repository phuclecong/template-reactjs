import { memo, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatDateTime, resolveLocale } from "@workspace/ui/lib/date"
import { DataTable } from "@workspace/shared-lib/components"
import { useDialog, useTableState } from "@workspace/shared-lib/hooks"
import { RetryableLazy } from "@/components/retryable-lazy"
import { TaskBulkActions } from "@/features/tasks/components/task-bulk-actions"
import { TaskFiltersBar } from "@/features/tasks/components/task-filters-bar"
import {
  prefetchTaskOverlay,
  taskOverlayLoaders,
} from "@/features/tasks/components/task-overlay-loaders"
import { useTaskBulkActions } from "@/features/tasks/hooks/use-task-bulk-actions"
import { useTasks } from "@/features/tasks/hooks/use-tasks"
import { toCrudFilters, type TaskRow } from "@/features/tasks/utils"
import { TASK_COLUMN_WIDTHS } from "@/features/tasks/utils/column-widths"
import type { CurrentUser } from "@/features/users/utils"
import { useIntentPrefetch } from "@/hooks/use-intent-prefetch"

const FILTER_KEYS = [
  "status",
  "priority",
  "assignee",
  "dueFrom",
  "dueTo",
] as const

/**
 * Memoized actions cell. `task` (the row object) and
 * `onEdit`/`onDelete`/`onPrefetchEdit`/`onPrefetchDelete` (stable
 * `useCallback`s) are referentially stable across renders, so `React.memo`
 * skips re-rendering these buttons when the table re-renders for selection or
 * pagination changes. `useIntentPrefetch` keeps the spreadable handlers stable
 * for the same reason.
 */
const TaskActionsCell = memo(function TaskActionsCell({
  task,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
  onPrefetchEdit,
  onPrefetchDelete,
}: {
  task: TaskRow
  editLabel: string
  deleteLabel: string
  onEdit: (task: TaskRow) => void
  onDelete: (task: TaskRow) => void
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
        disabled={!task.canModify}
        onClick={() => onEdit(task)}
        {...editIntentHandlers}
      >
        {editLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={!task.canModify}
        onClick={() => onDelete(task)}
        {...deleteIntentHandlers}
      >
        {deleteLabel}
      </Button>
    </div>
  )
})

export function TasksTable({ currentUser }: { currentUser: CurrentUser }) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)

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
    selectedIds,
    hasSelection,
    updateParams,
  } = useTableState({
    defaultSortField: "title",
    filterKeys: FILTER_KEYS,
  })

  const { status, priority, assignee, dueFrom, dueTo } = filterValues

  const formDialog = useDialog<TaskRow>()
  const deleteDialog = useDialog<TaskRow>()

  const filters = useMemo(
    () => toCrudFilters(q, filterValues),
    [q, filterValues]
  )

  const { rows, users, total, isLoading } = useTasks({
    currentUser,
    page,
    pageSize,
    sorters,
    filters,
  })

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const hasActiveFilters = Boolean(
    q || status || priority || assignee || dueFrom || dueTo
  )

  const { applyBulk, isApplying } = useTaskBulkActions({
    selectedIds,
    onDone: () => {
      setRowSelection({})
    },
  })

  // Stable so `TaskActionsCell`'s memo is not invalidated by table renders.
  const prefetchFormOverlay = useCallback(() => {
    void prefetchTaskOverlay("form")
  }, [])
  const prefetchDeleteOverlay = useCallback(() => {
    void prefetchTaskOverlay("delete")
  }, [])

  const columns = useMemo<ColumnDef<TaskRow>[]>(
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
        accessorKey: "assigneeName",
        header: t("tasks.columns.assignee"),
        size: TASK_COLUMN_WIDTHS.assignee,
        enableSorting: false,
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
      formDialog.open,
      deleteDialog.open,
      prefetchFormOverlay,
      prefetchDeleteOverlay,
      t,
      locale,
    ]
  )

  return (
    <div className="flex flex-col gap-4 p-6 text-sm">
      <TaskFiltersBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        values={filterValues}
        users={users}
        onChange={(next) => updateParams({ ...next, page: "" })}
        onClear={() =>
          updateParams({
            status: "",
            priority: "",
            assignee: "",
            dueFrom: "",
            dueTo: "",
            page: "",
          })
        }
      />

      <TaskBulkActions
        hasSelection={hasSelection}
        selectedCount={selectedIds.length}
        users={users}
        applyBulk={applyBulk}
        isApplying={isApplying}
        onCreate={formDialog.open}
      />

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        onSortingChange={onSortingChange}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        enableRowSelection={(row) => row.original.canModify}
        isLoading={isLoading}
        loadingLabel={t("tasks.loading")}
        emptyLabel={
          hasActiveFilters ? t("tasks.emptyNoMatch") : t("tasks.empty")
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

      {formDialog.isOpen ? (
        <RetryableLazy
          key={formDialog.version}
          loader={taskOverlayLoaders.form}
          props={{
            open: formDialog.isOpen,
            task: formDialog.data,
            users,
            onClose: formDialog.close,
          }}
        />
      ) : null}
      {deleteDialog.isOpen ? (
        <RetryableLazy
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
