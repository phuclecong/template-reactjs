import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { DateRangePicker } from "@workspace/ui/components/date-range-picker"
import { Input } from "@workspace/ui/components/input"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  FilterCombobox,
  type FilterOption,
} from "@workspace/shared-lib/components"
import {
  EMPTY_TASK_FILTERS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  taskFiltersEqual,
  type TaskFilters,
  type UserOption,
} from "@/features/tasks/utils"

export function TaskFiltersBar({
  searchValue,
  onSearchChange,
  values,
  users,
  onChange,
  onClear,
}: {
  searchValue: string
  onSearchChange: (value: string) => void
  values: TaskFilters
  users: UserOption[]
  onChange: (next: TaskFilters) => void
  onClear: () => void
}) {
  const { t, i18n } = useTranslation()

  // The URL is the source of truth, but `navigate()` commits asynchronously.
  // Two option clicks can therefore land before the new `values` prop arrives,
  // and Base UI would compute the second selection from the stale committed
  // value. Keep a synchronous optimistic value (state + ref) so each change
  // builds on the previous one, and pass it to the controls.
  const [optimisticFilters, setOptimisticFilters] =
    useState<TaskFilters>(values)
  const optimisticFiltersRef = useRef<TaskFilters>(values)
  // The last value committed upward whose URL echo has not arrived yet. While
  // it is set, an incoming `values` prop may be an intermediate navigation
  // echo, so the newer optimistic value wins; once the URL matches, drop the
  // marker.
  const unconfirmedFilters = useRef<TaskFilters | null>(null)

  const updateOptimisticFilters = useCallback((next: TaskFilters) => {
    optimisticFiltersRef.current = next
    setOptimisticFilters(next)
  }, [])

  const commitFilters = useCallback(
    (patch: Partial<TaskFilters>) => {
      const next = { ...optimisticFiltersRef.current, ...patch }
      unconfirmedFilters.current = next
      updateOptimisticFilters(next)
      onChange(next)
    },
    [onChange, updateOptimisticFilters]
  )

  useEffect(() => {
    if (unconfirmedFilters.current) {
      if (taskFiltersEqual(unconfirmedFilters.current, values)) {
        unconfirmedFilters.current = null
        updateOptimisticFilters(values)
      }
      return
    }
    // No write in flight: the URL changed externally (back/forward, clear).
    updateOptimisticFilters(values)
  }, [values, updateOptimisticFilters])

  const handleClear = useCallback(() => {
    unconfirmedFilters.current = null
    updateOptimisticFilters({ ...EMPTY_TASK_FILTERS })
    onClear()
  }, [onClear, updateOptimisticFilters])

  const { status, priority, assignee, dueFrom, dueTo } = optimisticFilters
  // Stable identities: Base UI re-syncs its selection when `items` changes, so
  // rebuilding these arrays on every render can drop a rapid second selection
  // before the URL-driven `value` prop catches up.
  const statusOptions = useMemo<FilterOption[]>(
    () =>
      STATUS_OPTIONS.map((value) => ({
        value,
        label: t(`tasks.status.${value}`),
      })),
    [t]
  )
  const priorityOptions = useMemo<FilterOption[]>(
    () =>
      PRIORITY_OPTIONS.map((value) => ({
        value,
        label: t(`tasks.priority.${value}`),
      })),
    [t]
  )
  const assigneeOptions = useMemo<FilterOption[]>(
    () => [
      ...users.map((user) => ({ value: user.id, label: user.name })),
      { value: "unassigned", label: t("tasks.unassigned") },
    ],
    [users, t]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={t("tasks.searchLabel")}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("tasks.searchPlaceholder")}
        className="w-56"
      />
      <FilterCombobox
        multiple
        options={statusOptions}
        value={status}
        onValueChange={(next) => commitFilters({ status: next })}
        ariaLabel={t("tasks.filters.status")}
        placeholder={t("tasks.filters.status")}
        className="w-56"
      />

      <FilterCombobox
        multiple
        options={priorityOptions}
        value={priority}
        onValueChange={(next) => commitFilters({ priority: next })}
        ariaLabel={t("tasks.filters.priority")}
        placeholder={t("tasks.filters.priority")}
        className="w-56"
      />

      <FilterCombobox
        multiple
        options={assigneeOptions}
        value={assignee}
        onValueChange={(next) => commitFilters({ assignee: next })}
        ariaLabel={t("tasks.filters.assignee")}
        placeholder={t("tasks.filters.assignee")}
        className="w-56"
      />

      <DateRangePicker
        id="tasks-due-date-filter"
        aria-label={t("tasks.filters.dueDate")}
        locale={resolveLocale(i18n.language)}
        placeholder={t("tasks.filters.dueDatePlaceholder")}
        clearLabel={t("tasks.filters.dueDateClear")}
        labels={{
          between: t("tasks.filters.dueDateModes.between"),
          from: t("tasks.filters.dueDateModes.from"),
          until: t("tasks.filters.dueDateModes.until"),
          today: t("tasks.filters.dueDatePresets.today"),
          last7Days: t("tasks.filters.dueDatePresets.last7Days"),
          thisMonth: t("tasks.filters.dueDatePresets.thisMonth"),
          mode: t("tasks.filters.dueDateMode"),
        }}
        value={{ from: dueFrom, to: dueTo }}
        onChange={(next) =>
          commitFilters({
            dueFrom: next.from,
            dueTo: next.to,
          })
        }
      />

      <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
        {t("tasks.filters.clear")}
      </Button>
    </div>
  )
}
