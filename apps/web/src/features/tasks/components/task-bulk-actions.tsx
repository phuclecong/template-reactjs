import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { DatePicker } from "@workspace/ui/components/date-picker"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  formValueToDueDate,
  type TaskPriority,
  type TaskStatus,
  type UserOption,
} from "@/features/tasks/utils"

export function TaskBulkActions({
  hasSelection,
  selectedCount,
  users,
  applyBulk,
  onCreate,
}: {
  hasSelection: boolean
  selectedCount: number
  users: UserOption[]
  applyBulk: (patch: {
    status?: TaskStatus
    priority?: TaskPriority | null
    assigneeId?: string | null
    dueDate?: string | null
  }) => void
  onCreate: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)
  const [dueDate, setDueDate] = useState("")

  return (
    <div className="flex items-center gap-2">
      {hasSelection ? (
        <span className="text-muted-foreground">
          {t("tasks.selectedCount", { count: selectedCount })}
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasSelection}
              />
            }
            disabled={!hasSelection}
          >
            {t("tasks.bulk.updateStatus")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => applyBulk({ status: option })}
              >
                {t(`tasks.status.${option}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasSelection}
              />
            }
            disabled={!hasSelection}
          >
            {t("tasks.bulk.updatePriority")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {PRIORITY_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => applyBulk({ priority: option })}
              >
                {t(`tasks.priority.${option}`)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => applyBulk({})}>
              {t("tasks.bulk.none")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasSelection}
              />
            }
            disabled={!hasSelection}
          >
            {t("tasks.bulk.assign")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => applyBulk({ assigneeId: user.id })}
              >
                {user.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => applyBulk({})}>
              {t("tasks.unassigned")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasSelection}
          onClick={() => applyBulk({ dueDate: null })}
        >
          {t("tasks.bulk.clearDueDate")}
        </Button>

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
    </div>
  )
}
