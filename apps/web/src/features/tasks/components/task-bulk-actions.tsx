import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Combobox, ComboboxTrigger } from "@workspace/ui/components/combobox"
import { RetryableLazy } from "@/components/retryable-lazy"
import {
  taskOverlayLoaders,
  prefetchTaskOverlay,
} from "@/features/tasks/components/task-overlay-loaders"
import type {
  BulkActionGroup,
  BulkActionItem,
  BulkPatch,
  PendingBulkAction,
} from "@/features/tasks/components/task-bulk-actions-content"
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  formValueToDueDate,
  type UserOption,
} from "@/features/tasks/utils"
import { useIntentPrefetch } from "@/hooks/use-intent-prefetch"

/**
 * Base UI's default collator matcher searches each item's label. Feeding it the
 * group heading plus the item label lets "assign", "status", and "priority"
 * match without a custom filter implementation.
 */
function actionSearchLabel(item: BulkActionItem): string {
  return `${item.groupLabel} ${item.label}`
}

export function TaskBulkActions({
  hasSelection,
  selectedCount,
  users,
  applyBulk,
  isApplying,
  onCreate,
}: {
  hasSelection: boolean
  selectedCount: number
  users: UserOption[]
  applyBulk: (patch: BulkPatch, options?: { onSettled?: () => void }) => void
  isApplying: boolean
  onCreate: () => void
}) {
  const { t } = useTranslation()
  const [dueDate, setDueDate] = useState("")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [contentMounted, setContentMounted] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingBulkAction>(null)

  const prefetchBulk = useCallback(() => {
    void prefetchTaskOverlay("bulk")
  }, [])
  const prefetchForm = useCallback(() => {
    void prefetchTaskOverlay("form")
  }, [])

  const bulkIntentHandlers = useIntentPrefetch(prefetchBulk)
  const formIntentHandlers = useIntentPrefetch(prefetchForm)

  const groups = useMemo<BulkActionGroup[]>(() => {
    const statusLabel = t("tasks.filters.status")
    const priorityLabel = t("tasks.filters.priority")
    const assigneeLabel = t("tasks.filters.assignee")
    const dueDateLabel = t("tasks.filters.dueDate")

    return [
      {
        value: statusLabel,
        items: STATUS_OPTIONS.map((status) => ({
          id: `status:${status}`,
          label: t(`tasks.status.${status}`),
          groupLabel: statusLabel,
          patch: { status },
        })),
      },
      {
        value: priorityLabel,
        items: [
          ...PRIORITY_OPTIONS.map((priority) => ({
            id: `priority:${priority}`,
            label: t(`tasks.priority.${priority}`),
            groupLabel: priorityLabel,
            patch: { priority },
          })),
          {
            id: "priority:none",
            label: t("tasks.bulk.none"),
            groupLabel: priorityLabel,
            patch: { priority: null },
          },
        ],
      },
      {
        value: assigneeLabel,
        items: [
          ...users.map((user) => ({
            id: `assignee:${user.id}`,
            label: user.name,
            groupLabel: assigneeLabel,
            patch: { assigneeId: user.id },
          })),
          {
            id: "assignee:unassigned",
            label: t("tasks.unassigned"),
            groupLabel: assigneeLabel,
            patch: { assigneeId: null },
          },
        ],
      },
      {
        value: dueDateLabel,
        items: [
          {
            id: "dueDate:clear",
            label: t("tasks.bulk.clearDueDate"),
            groupLabel: dueDateLabel,
            patch: { dueDate: null },
          },
        ],
      },
    ]
  }, [t, users])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) setContentMounted(true)
    if (!nextOpen) setSearch("")
  }

  function handleSelect(item: BulkActionItem | null) {
    if (!item) return
    setOpen(false)
    setSearch("")
    setPendingAction({ item, count: selectedCount })
  }

  function dueDateAction(value: string): BulkActionItem {
    return {
      id: "dueDate:set",
      label: t("tasks.bulk.setDueDate"),
      groupLabel: t("tasks.filters.dueDate"),
      patch: { dueDate: formValueToDueDate(value) },
    }
  }

  function handleCancel() {
    if (isApplying) return
    setPendingAction(null)
  }

  function handleConfirm() {
    if (!pendingAction) return
    applyBulk(pendingAction.item.patch, {
      onSettled: () => setPendingAction(null),
    })
  }

  return (
    <div className="flex items-center gap-2">
      {hasSelection ? (
        <span className="text-muted-foreground">
          {t("tasks.selectedCount", { count: selectedCount })}
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Combobox
          items={groups}
          value={null}
          open={open}
          onOpenChange={handleOpenChange}
          onValueChange={handleSelect}
          inputValue={search}
          onInputValueChange={setSearch}
          itemToStringLabel={actionSearchLabel}
          disabled={!hasSelection}
        >
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasSelection}
              />
            }
            disabled={!hasSelection}
            aria-label={t("tasks.bulk.actions")}
            {...bulkIntentHandlers}
          >
            {t("tasks.bulk.actions")}
          </ComboboxTrigger>

          {contentMounted ? (
            <RetryableLazy
              loader={taskOverlayLoaders.bulk}
              props={{
                dueDate,
                onDueDateChange: setDueDate,
                onDueDateDone: (value) => handleSelect(dueDateAction(value)),
                onDueDateOpenChange: (nextOpen) => {
                  if (!nextOpen) setDueDate("")
                },
                disabled: !hasSelection,
                pendingAction,
                isApplying,
                onCancel: handleCancel,
                onConfirm: handleConfirm,
              }}
            />
          ) : null}
        </Combobox>

        <Button
          type="button"
          onClick={() => onCreate()}
          {...formIntentHandlers}
          size="sm"
        >
          {t("tasks.new")}
        </Button>
      </div>
    </div>
  )
}
