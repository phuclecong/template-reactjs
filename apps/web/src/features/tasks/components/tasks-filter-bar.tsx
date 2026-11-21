import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CrudFilter } from "@refinedev/core"
import { XIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  ComboboxFilter,
  DateRangeFilter,
  FilterBar,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { useEnums } from "@workspace/shared-lib/hooks"

import {
  clearTaskFilter,
  taskFilterChips,
  taskFiltersFromCrud,
  taskFiltersToCrud,
  type TaskFilterKey,
  type TaskFilterValues,
} from "@/features/tasks/utils/filters"
import type { UserOption } from "@/features/tasks/utils"

/** The search term commits only after the user pauses for this long. */
export const TEXT_FILTER_DEBOUNCE_MS = 300

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

  const chips = useMemo(
    () =>
      taskFilterChips(values, {
        t,
        statusOptions,
        priorityOptions,
        assigneeOptions,
      }),
    [values, statusOptions, priorityOptions, assigneeOptions, t]
  )

  return (
    <FilterBar
      label={t("tasks.filters.label")}
      toggleLabel={t("common.filters")}
      activeCount={chips.length}
      footer={
        chips.length > 0 ? (
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
        ) : null
      }
    >
      <Input
        aria-label={t("tasks.searchLabel")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("tasks.searchPlaceholder")}
        className="w-full sm:w-56"
      />
      <ComboboxFilter
        multiple
        options={statusOptions}
        value={values.status}
        onValueChange={(value) => commit({ status: value })}
        ariaLabel={t("tasks.filters.status")}
        placeholder={t("tasks.filters.status")}
        className="w-full sm:w-56"
      />
      <ComboboxFilter
        multiple
        options={priorityOptions}
        value={values.priority}
        onValueChange={(value) => commit({ priority: value })}
        ariaLabel={t("tasks.filters.priority")}
        placeholder={t("tasks.filters.priority")}
        className="w-full sm:w-56"
      />
      <ComboboxFilter
        multiple
        options={assigneeOptions}
        value={values.assignee}
        onValueChange={(value) => commit({ assignee: value })}
        ariaLabel={t("tasks.filters.assignee")}
        placeholder={t("tasks.filters.assignee")}
        className="w-full sm:w-56"
      />
      <DateRangeFilter
        id="tasks-due-date-filter"
        ariaLabel={t("tasks.filters.dueDate")}
        placeholder={t("tasks.filters.dueDatePlaceholder")}
        clearLabel={t("tasks.filters.dueDateClear")}
        className="w-full sm:w-56"
        value={{ from: values.dueFrom, to: values.dueTo }}
        onChange={(next) =>
          commit({
            dueFrom: next.from,
            dueTo: next.to,
          })
        }
      />
    </FilterBar>
  )
}
