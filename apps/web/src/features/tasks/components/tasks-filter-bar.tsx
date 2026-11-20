import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CrudFilter } from "@refinedev/core"
import { XIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  ComboboxFilter,
  DateRangeFilter,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { useEnums } from "@workspace/shared-lib/hooks"
import { parseFilterValues } from "@workspace/shared-lib/utils"

import {
  clearTaskFilter,
  taskFiltersFromCrud,
  taskFiltersToCrud,
  type TaskFilterKey,
  type TaskFilterValues,
} from "@/features/tasks/utils/filters"
import type { UserOption } from "@/features/tasks/utils"

/** The search term commits only after the user pauses for this long. */
export const TEXT_FILTER_DEBOUNCE_MS = 300

type Chip = { key: TaskFilterKey; label: string }

function dateRangeText(
  from: string,
  to: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (from && to) return t("tasks.filters.dateRange", { from, to })
  if (from) return t("tasks.filters.dateFrom", { date: from })
  return t("tasks.filters.dateUntil", { date: to })
}

/**
 * The Tasks filter bar and its active-filter chips. It is a controlled view of
 * Refine's `CrudFilter[]` — the same pattern as the Roles bar — so the URL,
 * chips, and controls always agree. The search term is one `contains` filter;
 * every change replaces the filter state through `onChange`.
 */
export function TasksFilterBar({
  filters,
  users,
  onChange,
}: {
  filters: CrudFilter[]
  users: UserOption[]
  onChange: (filters: CrudFilter[]) => void
}) {
  const { t } = useTranslation()
  const values = useMemo(() => taskFiltersFromCrud(filters), [filters])
  const {
    TASK_STATUS_OPTIONS: statusOptions,
    TASK_PRIORITY_OPTIONS: priorityOptions,
  } = useEnums()

  const [search, setSearch] = useState(values.q)

  // External filter changes — a chip removal, Clear all, or browser
  // back/forward — reset the local draft during render, so the debounce does
  // not keep a stale term.
  const [lastQ, setLastQ] = useState(values.q)
  if (values.q !== lastQ) {
    setLastQ(values.q)
    setSearch(values.q)
  }

  const emit = useCallback(
    (next: TaskFilterValues) => {
      onChange(taskFiltersToCrud(next))
    },
    [onChange]
  )

  // Builds on the newest local search so a filter change never drops keystrokes
  // whose debounce has not fired yet.
  const commit = useCallback(
    (patch: Partial<TaskFilterValues>) => {
      emit({ ...values, q: search, ...patch })
    },
    [emit, values, search]
  )

  useEffect(() => {
    if (search === values.q) return
    const timer = window.setTimeout(() => {
      commit({ q: search })
    }, TEXT_FILTER_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search, values.q, commit])

  const removeFilter = useCallback(
    (key: TaskFilterKey) => {
      emit(clearTaskFilter({ ...values, q: search }, key))
    },
    [emit, values, search]
  )

  const clearAll = useCallback(() => {
    setSearch("")
    onChange([])
  }, [onChange])

  // Stable identities: Base UI re-syncs its selection when `items` changes.
  const assigneeOptions = useMemo<FilterOption[]>(
    () => [
      ...users.map((user) => ({ value: user.id, label: user.name })),
      { value: "unassigned", label: t("tasks.unassigned") },
    ],
    [users, t]
  )

  const optionLabel = useCallback(
    (options: readonly FilterOption[], value: string) =>
      options.find((option) => option.value === value)?.label ?? value,
    []
  )

  const chips = useMemo<Chip[]>(() => {
    const next: Chip[] = []
    if (values.q) {
      next.push({
        key: "q",
        label: t("tasks.filters.chipSearch", { value: values.q }),
      })
    }
    if (values.status) {
      const labels = parseFilterValues(values.status).map((status) =>
        optionLabel(statusOptions, status)
      )
      next.push({
        key: "status",
        label: t("tasks.filters.chipStatus", { value: labels.join(", ") }),
      })
    }
    if (values.priority) {
      const labels = parseFilterValues(values.priority).map((priority) =>
        optionLabel(priorityOptions, priority)
      )
      next.push({
        key: "priority",
        label: t("tasks.filters.chipPriority", { value: labels.join(", ") }),
      })
    }
    if (values.assignee) {
      const labels = parseFilterValues(values.assignee).map((assignee) =>
        optionLabel(assigneeOptions, assignee)
      )
      next.push({
        key: "assignee",
        label: t("tasks.filters.chipAssignee", { value: labels.join(", ") }),
      })
    }
    if (values.dueFrom || values.dueTo) {
      next.push({
        key: "dueDate",
        label: t("tasks.filters.chipDueDate", {
          value: dateRangeText(values.dueFrom, values.dueTo, t),
        }),
      })
    }
    return next
  }, [
    values,
    statusOptions,
    priorityOptions,
    assigneeOptions,
    optionLabel,
    t,
  ])

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t("tasks.filters.label")}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          aria-label={t("tasks.searchLabel")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("tasks.searchPlaceholder")}
          className="w-56"
        />
        <ComboboxFilter
          multiple
          options={statusOptions}
          value={values.status}
          onValueChange={(value) => commit({ status: value })}
          ariaLabel={t("tasks.filters.status")}
          placeholder={t("tasks.filters.status")}
          className="w-56"
        />
        <ComboboxFilter
          multiple
          options={priorityOptions}
          value={values.priority}
          onValueChange={(value) => commit({ priority: value })}
          ariaLabel={t("tasks.filters.priority")}
          placeholder={t("tasks.filters.priority")}
          className="w-56"
        />
        <ComboboxFilter
          multiple
          options={assigneeOptions}
          value={values.assignee}
          onValueChange={(value) => commit({ assignee: value })}
          ariaLabel={t("tasks.filters.assignee")}
          placeholder={t("tasks.filters.assignee")}
          className="w-56"
        />
        <DateRangeFilter
          id="tasks-due-date-filter"
          ariaLabel={t("tasks.filters.dueDate")}
          placeholder={t("tasks.filters.dueDatePlaceholder")}
          clearLabel={t("tasks.filters.dueDateClear")}
          value={{ from: values.dueFrom, to: values.dueTo }}
          onChange={(next) =>
            commit({
              dueFrom: next.from,
              dueTo: next.to,
            })
          }
        />
      </div>

      {chips.length > 0 && (
        <div
          role="group"
          aria-label={t("tasks.filters.activeFilters")}
          className="flex flex-wrap items-center gap-2"
        >
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-1 pl-2.5 text-xs"
            >
              <span>{chip.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("tasks.filters.removeFilter", {
                  filter: chip.label,
                })}
                onClick={() => removeFilter(chip.key)}
              >
                <XIcon className="pointer-events-none" />
              </Button>
            </span>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            {t("tasks.filters.clearAll")}
          </Button>
        </div>
      )}
    </div>
  )
}
