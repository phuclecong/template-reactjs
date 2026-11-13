import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@workspace/ui/components/combobox"
import { DateRangePicker } from "@workspace/ui/components/date-range-picker"
import { Input } from "@workspace/ui/components/input"
import { InputGroup } from "@workspace/ui/components/input-group"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  joinFilterValues,
  parseFilterValues,
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
      <InputGroup className="h-auto min-h-8 w-56 flex-wrap items-center py-1">
        <ComboboxValue>
          {(selected: string[]) => (
            <ComboboxChips className="min-w-0 flex-1">
              {selected.map((selectedValue) => {
                const label = labelFor(selectedValue)
                return (
                  <ComboboxChip key={selectedValue} aria-label={label}>
                    {label}
                    <ComboboxChipRemove
                      aria-label={t("combobox.removeChip", { value: label })}
                    />
                  </ComboboxChip>
                )
              })}
              <ComboboxInput
                aria-label={ariaLabel}
                placeholder={selected.length > 0 ? "" : placeholder}
                className="h-6 min-w-16 flex-1 border-0 bg-transparent px-1 py-0 shadow-none ring-0 focus-visible:ring-0 dark:bg-transparent"
              />
            </ComboboxChips>
          )}
        </ComboboxValue>
        <ComboboxClear aria-label={t("common.clear")} />
        <ComboboxIcon aria-hidden="true" className="pointer-events-none mr-1.5" />
      </InputGroup>
      <ComboboxContent>
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
  const { status, priority, assignee, dueFrom, dueTo } = values
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
        onValueChange={(next) => onChange({ ...values, status: next })}
        ariaLabel={t("tasks.filters.status")}
        placeholder={t("tasks.filters.all")}
      />

      <FilterCombobox
        items={PRIORITY_OPTIONS}
        labelFor={priorityLabel}
        value={priority}
        onValueChange={(next) => onChange({ ...values, priority: next })}
        ariaLabel={t("tasks.filters.priority")}
        placeholder={t("tasks.filters.all")}
      />

      <FilterCombobox
        items={assigneeOptions}
        labelFor={assigneeLabel}
        value={assignee}
        onValueChange={(next) => onChange({ ...values, assignee: next })}
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
          onChange({
            ...values,
            dueFrom: next.from,
            dueTo: next.to,
          })
        }
      />

      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        {t("tasks.filters.clear")}
      </Button>
    </div>
  )
}
