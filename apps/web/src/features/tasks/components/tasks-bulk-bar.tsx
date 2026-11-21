import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import type { TaskRecord } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"

import { RetryableLazy } from "@/components/retryable-lazy"
import {
  prefetchTaskOverlay,
  taskOverlayLoaders,
} from "@/features/tasks/components/tasks-overlay-loaders"
import {
  useTaskBulkActions,
  type TaskBulkPatch,
} from "@/features/tasks/hooks/use-task-bulk-actions"
import type { UserOption } from "@/features/tasks/utils"
import { useIntentPrefetch } from "@/hooks/use-intent-prefetch"

/**
 * The bar above the Tasks table. It appears once rows are selected, reports
 * the page-scoped selection count, and opens the bulk-edit sheet. The sheet is
 * still code-split (it carries the calendar) and is warmed on Edit intent.
 */
export function TasksBulkBar({
  selectedTasks,
  users,
  onDone,
}: {
  selectedTasks: TaskRecord[]
  users: UserOption[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  // Remounting the form for each session discards draft values.
  const [editSession, setEditSession] = useState(0)
  const [sheetMounted, setSheetMounted] = useState(false)

  const { bulkUpdate, isApplying } = useTaskBulkActions({
    selected: selectedTasks.map((task) => ({
      id: task.id,
      title: task.title,
    })),
    onDone: () => {
      setEditOpen(false)
      onDone()
    },
  })

  const prefetchSheet = useCallback(() => {
    void prefetchTaskOverlay("bulk")
  }, [])
  const intentHandlers = useIntentPrefetch(prefetchSheet)

  const openEdit = () => {
    setEditSession((session) => session + 1)
    setSheetMounted(true)
    setEditOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && isApplying) return
    setEditOpen(open)
  }

  const applyPatch = (patch: TaskBulkPatch) => {
    bulkUpdate(patch, { onSettled: () => setEditOpen(false) })
  }

  return (
    <>
      <div
        role="region"
        aria-label={t("tasks.bulk.actions")}
        className="flex animate-fade-in flex-wrap items-center gap-2 border border-border bg-muted/40 px-3 py-2"
      >
        <span className="font-medium">
          {t("tasks.bulk.selected", { count: selectedTasks.length })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openEdit}
            {...intentHandlers}
          >
            {t("tasks.bulk.edit")}
          </Button>
        </div>
      </div>

      {sheetMounted ? (
        <RetryableLazy
          key={editSession}
          loader={taskOverlayLoaders.bulk}
          props={{
            open: editOpen,
            onOpenChange: handleOpenChange,
            selectedCount: selectedTasks.length,
            users,
            onApply: applyPatch,
            isApplying,
          }}
        />
      ) : null}
    </>
  )
}
