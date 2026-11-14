import { useTranslation } from "react-i18next"
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { DatePicker } from "@workspace/ui/components/date-picker"
import { resolveLocale } from "@workspace/ui/lib/date"
import type { TaskPriority, TaskStatus } from "@/features/tasks/utils"

export type BulkPatch = {
  status?: TaskStatus
  priority?: TaskPriority | null
  assigneeId?: string | null
  dueDate?: string | null
}

export type BulkActionItem = {
  id: string
  label: string
  /** The group heading, carried on the item so search can match it. */
  groupLabel: string
  patch: BulkPatch
}

export type BulkActionGroup = {
  value: string
  items: BulkActionItem[]
}

export type PendingBulkAction = {
  item: BulkActionItem
  count: number
} | null

export type TaskBulkActionsContentProps = {
  dueDate: string
  onDueDateChange: (value: string) => void
  onDueDateDone: (value: string) => void
  onDueDateOpenChange: (open: boolean) => void
  disabled: boolean
  pendingAction: PendingBulkAction
  isApplying: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * The heavy half of the bulk-actions toolbar: the combobox popup (including
 * `DatePicker`/calendar code) and the confirmation dialog. It is dynamically
 * imported on first intent/open so the persistent toolbar can stay eager.
 *
 * It renders as a child of the `Combobox` root in `TaskBulkActions`, so it
 * keeps the registry combobox context while its module is deferred.
 */
export function TaskBulkActionsContent({
  dueDate,
  onDueDateChange,
  onDueDateDone,
  onDueDateOpenChange,
  disabled,
  pendingAction,
  isApplying,
  onCancel,
  onConfirm,
}: TaskBulkActionsContentProps) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)

  return (
    <>
      <ComboboxContent>
        <div className="p-1">
          <ComboboxInput
            aria-label={t("tasks.bulk.searchActions")}
            placeholder={t("tasks.bulk.searchActions")}
            showTrigger={false}
          />
        </div>
        <ComboboxEmpty>{t("combobox.noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(group: BulkActionGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel className="mt-2 border-t border-border px-1 py-1.5 text-xs font-bold text-muted-foreground">
                {group.value}
              </ComboboxLabel>
              {group.items.map((item) => (
                <ComboboxItem key={item.id} value={item}>
                  {item.label}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}
        </ComboboxList>
        <DatePicker
          aria-label={t("tasks.bulk.setDueDate")}
          value={dueDate}
          // Keep the picked value as a draft; `Done` resolves it through the
          // same confirmation flow as the other bulk actions, and closing the
          // picker discards the draft.
          onChange={(value) => {
            if (!value) return

            onDueDateChange(value)
          }}
          onDone={(value) => {
            if (!value) return

            onDueDateDone(value)
          }}
          onOpenChange={onDueDateOpenChange}
          disabled={disabled}
          locale={locale}
          placeholder={t("tasks.bulk.setDueDate")}
          labels={{
            clear: t("common.clear"),
            done: t("common.done"),
            time: t("datePicker.time"),
            typedEntryLabel: t("datePicker.typedLabel"),
            typedEntryHint: t("datePicker.typedHint"),
            typedEntryError: t("datePicker.typedError"),
          }}
          className="w-44"
        />
      </ComboboxContent>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={onCancel}
        title={t("tasks.bulk.confirmTitle", {
          action: pendingAction?.item.label ?? "",
          count: pendingAction?.count ?? 0,
        })}
        description={t("tasks.bulk.confirmBody", {
          count: pendingAction?.count ?? 0,
        })}
        confirmLabel={t("tasks.bulk.apply")}
        cancelLabel={t("common.cancel")}
        tone="default"
        loading={isApplying}
        onConfirm={onConfirm}
      />
    </>
  )
}
