import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@workspace/ui/components/combobox"
import { DateRangePicker } from "@workspace/ui/components/date-range-picker"
import { Input } from "@workspace/ui/components/input"
import { XIcon } from "lucide-react"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  EMPTY_TASK_FILTERS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  joinFilterValues,
  parseFilterValues,
  taskFiltersEqual,
  type TaskFilters,
  type UserOption,
} from "@/features/tasks/utils"

/**
 * One multi-select chip field. The URL-facing value is a comma-joined string;
 * the lookup and change are passed through so each filter keeps its own label
 * source and `TaskFilters` key.
 */
function FilterCombobox({
  items,
  labelFor,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
}: {
  items: readonly string[]
  labelFor: (value: string) => string
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  placeholder: string
}) {
  const { t } = useTranslation()
  const selectedValues = parseFilterValues(value)
  const anchor = useComboboxAnchor()

  // The registry chip exposes removal through `showRemove`, whose internal
  // control is icon-only. Compose a labelled Button so the mouse affordance
  // keeps its accessible name; the chip itself still handles Backspace and
  // Delete, and Left/Right Arrow moves focus between chips.
  const removeValue = (selected: string[], removed: string) =>
    onValueChange(
      joinFilterValues(selected.filter((candidate) => candidate !== removed))
    )

  return (
    <Combobox
      multiple
      items={items}
      itemToStringLabel={labelFor}
      value={selectedValues}
      onValueChange={(next) => onValueChange(joinFilterValues(next))}
      onOpenChange={(open, details) => {
        // Multi-select: picking a value must not close the popup, so several
        // values can be chosen from one query.
        if (!open && details.reason === "item-press") details.cancel()
      }}
    >
      <ComboboxChips ref={anchor} className="w-56">
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((selectedValue) => {
                const label = labelFor(selectedValue)
                return (
                  <ComboboxChip
                    key={selectedValue}
                    aria-label={label}
                    showRemove={false}
                  >
                    {label}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("combobox.removeChip", { value: label })}
                      className="-ml-1 opacity-50 hover:opacity-100"
                      onClick={() => removeValue(selected, selectedValue)}
                    >
                      <XIcon className="pointer-events-none" />
                    </Button>
                  </ComboboxChip>
                )
              })}
              <ComboboxChipsInput
                aria-label={ariaLabel}
                placeholder={selected.length > 0 ? "" : placeholder}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{t("combobox.noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(option: string) => (
            <ComboboxItem key={option} value={option}>
              {labelFor(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

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
  // rebuilding these arrays/functions on every render can drop a rapid second
  // selection before the URL-driven `value` prop catches up.
  const assigneeOptions = useMemo(
    () => [...users.map((user) => user.id), "unassigned"],
    [users]
  )
  const userNameById = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users]
  )
  const statusLabel = useCallback(
    (value: string) => t(`tasks.status.${value}`),
    [t]
  )
  const priorityLabel = useCallback(
    (value: string) => t(`tasks.priority.${value}`),
    [t]
  )
  const assigneeLabel = useCallback(
    (id: string) =>
      id === "unassigned"
        ? t("tasks.unassigned")
        : (userNameById.get(id) ?? id),
    [userNameById, t]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={t("tasks.searchLabel")}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("tasks.searchPlaceholder")}
        className="w-72"
      />
      <FilterCombobox
        items={STATUS_OPTIONS}
        labelFor={statusLabel}
        value={status}
        onValueChange={(next) => commitFilters({ status: next })}
        ariaLabel={t("tasks.filters.status")}
        placeholder={t("tasks.filters.all")}
      />

      <FilterCombobox
        items={PRIORITY_OPTIONS}
        labelFor={priorityLabel}
        value={priority}
        onValueChange={(next) => commitFilters({ priority: next })}
        ariaLabel={t("tasks.filters.priority")}
        placeholder={t("tasks.filters.all")}
      />

      <FilterCombobox
        items={assigneeOptions}
        labelFor={assigneeLabel}
        value={assignee}
        onValueChange={(next) => commitFilters({ assignee: next })}
        ariaLabel={t("tasks.filters.assignee")}
        placeholder={t("tasks.filters.all")}
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
