import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@workspace/ui/components/combobox"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { DatePicker } from "@workspace/ui/components/date-picker"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  formValueToDueDate,
  type TaskPriority,
  type TaskStatus,
  type UserOption,
} from "@/features/tasks/utils"

type BulkPatch = {
  status?: TaskStatus
  priority?: TaskPriority | null
  assigneeId?: string | null
  dueDate?: string | null
}

type BulkActionItem = {
  id: string
  label: string
  /** The group heading, carried on the item so search can match it. */
  groupLabel: string
  patch: BulkPatch
}

type BulkActionGroup = {
  value: string
  items: BulkActionItem[]
}

const collator = new Intl.Collator(undefined, {
  usage: "search",
  sensitivity: "base",
  ignorePunctuation: true,
})

/**
 * Base UI filters each item by its label only. Bulk action search must also
 * match the group heading ("assign", "status", …), so the heading rides along
 * on every item and this custom filter searches both.
 */
function matchesAction(item: BulkActionItem, query: string): boolean {
  if (!query) return true
  const haystack = `${item.groupLabel} ${item.label}`
  for (let i = 0; i <= haystack.length - query.length; i += 1) {
    if (collator.compare(haystack.slice(i, i + query.length), query) === 0) {
      return true
    }
  }
  return false
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
  applyBulk: (patch: BulkPatch) => void
  isApplying: boolean
  onCreate: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)
  const [dueDate, setDueDate] = useState("")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [pendingAction, setPendingAction] = useState<{
    item: BulkActionItem
    count: number
  } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const wasApplying = useRef(false)

  // The confirmation stays up until an in-flight update settles, then closes.
  useEffect(() => {
    if (!submitted) return
    if (isApplying) {
      wasApplying.current = true
      return
    }
    if (wasApplying.current) {
      wasApplying.current = false
      setSubmitted(false)
      setPendingAction(null)
    }
  }, [submitted, isApplying])

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
    if (!nextOpen) setSearch("")
  }

  function handleSelect(item: BulkActionItem | null) {
    if (!item) return
    setOpen(false)
    setSearch("")
    setPendingAction({ item, count: selectedCount })
  }

  function handleCancel() {
    if (isApplying) return
    setSubmitted(false)
    wasApplying.current = false
    setPendingAction(null)
  }

  function handleConfirm() {
    if (!pendingAction) return
    setSubmitted(true)
    applyBulk(pendingAction.item.patch)
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
          filter={matchesAction}
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
          >
            {t("tasks.bulk.actions")}
            <ComboboxIcon />
          </ComboboxTrigger>
          <ComboboxContent>
            <div className="p-1">
              <ComboboxInput
                aria-label={t("tasks.bulk.searchActions")}
                placeholder={t("tasks.bulk.searchActions")}
              />
            </div>
            <ComboboxEmpty>{t("combobox.noResults")}</ComboboxEmpty>
            <ComboboxList>
              {(group: BulkActionGroup) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  {group.items.map((item) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.label}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <DatePicker
          aria-label={t("tasks.bulk.setDueDate")}
          value={dueDate}
          // Bulk updates apply immediately; the control stays open so the
          // time can still be adjusted, then resets when it closes.
          onChange={(value) => {
            if (!value) return
            setDueDate(value)
            applyBulk({ dueDate: formValueToDueDate(value) })
          }}
          onOpenChange={(open) => {
            if (!open) setDueDate("")
          }}
          disabled={!hasSelection}
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

        <Button type="button" onClick={() => onCreate()} size="sm">
          {t("tasks.new")}
        </Button>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={handleCancel}
        title={t("tasks.bulk.confirmTitle", {
          action: pendingAction?.item.label ?? "",
          count: pendingAction?.count ?? 0,
        })}
        confirmLabel={t("tasks.bulk.apply")}
        cancelLabel={t("common.cancel")}
        tone="default"
        loading={isApplying}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
