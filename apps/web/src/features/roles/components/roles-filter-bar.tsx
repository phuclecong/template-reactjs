import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CrudFilter } from "@refinedev/core"
import { XIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { DateRangePicker } from "@workspace/ui/components/date-range-picker"
import { Input } from "@workspace/ui/components/input"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  FilterCombobox,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { parseFilterValues } from "@workspace/shared-lib/utils"

import {
  clearRoleFilter,
  roleFiltersFromCrud,
  roleFiltersToCrud,
  type RoleFilterKey,
  type RoleFilterValues,
} from "@/features/roles/utils/filters"

/** Text filters commit only after the user pauses for this long. */
export const TEXT_FILTER_DEBOUNCE_MS = 300

type Chip = { key: RoleFilterKey; label: string }

function dateRangeText(
  from: string,
  to: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (from && to) return t("roles.filters.dateRange", { from, to })
  if (from) return t("roles.filters.dateFrom", { date: from })
  return t("roles.filters.dateUntil", { date: to })
}

/**
 * The Roles filter bar and its active-filter chips. It is a controlled view of
 * Refine's `CrudFilter[]`: values are read back from the filter state (so the
 * URL, chips, and controls always agree) and every change replaces that state
 * through `onChange`. Text input is debounced; all other controls commit
 * immediately.
 */
export function RolesFilterBar({
  filters,
  onChange,
}: {
  filters: CrudFilter[]
  onChange: (filters: CrudFilter[]) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)
  const values = useMemo(() => roleFiltersFromCrud(filters), [filters])

  const [title, setTitle] = useState(values.title)
  const [description, setDescription] = useState(values.description)

  // External filter changes — a chip removal, Clear all, or browser
  // back/forward — are applied during render from the previous prop values.
  // This keeps the debounce drafts in step with Refine's state without an
  // extra effect-driven render or a second source of truth.
  const [lastValues, setLastValues] = useState({
    title: values.title,
    description: values.description,
  })
  if (
    values.title !== lastValues.title ||
    values.description !== lastValues.description
  ) {
    setLastValues({ title: values.title, description: values.description })
    setTitle(values.title)
    setDescription(values.description)
  }

  const emit = useCallback(
    (next: RoleFilterValues) => {
      onChange(roleFiltersToCrud(next))
    },
    [onChange]
  )

  // Builds on the newest local text so a filter change never drops keystrokes
  // whose debounce has not fired yet.
  const commit = useCallback(
    (patch: Partial<RoleFilterValues>) => {
      emit({ ...values, title, description, ...patch })
    },
    [emit, values, title, description]
  )

  useEffect(() => {
    if (title === values.title) return
    const timer = window.setTimeout(() => {
      commit({ title })
    }, TEXT_FILTER_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [title, values.title, commit])

  useEffect(() => {
    if (description === values.description) return
    const timer = window.setTimeout(() => {
      commit({ description })
    }, TEXT_FILTER_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [description, values.description, commit])

  const removeFilter = useCallback(
    (key: RoleFilterKey) => {
      emit(clearRoleFilter({ ...values, title, description }, key))
    },
    [emit, values, title, description]
  )

  // Clear all also resets the local drafts: when only uncommitted text is
  // pending, the emitted filter state does not change, so the render-time
  // external sync would not fire.
  const clearAll = useCallback(() => {
    setTitle("")
    setDescription("")
    onChange([])
  }, [onChange])

  const chips = useMemo<Chip[]>(() => {
    const next: Chip[] = []
    if (values.title) {
      next.push({
        key: "title",
        label: t("roles.filters.chipTitle", { value: values.title }),
      })
    }
    if (values.description) {
      next.push({
        key: "description",
        label: t("roles.filters.chipDescription", {
          value: values.description,
        }),
      })
    }
    if (values.status) {
      const statusLabels = parseFilterValues(values.status).map((status) =>
        status === "active"
          ? t("roles.filters.statusActive")
          : t("roles.filters.statusInactive")
      )
      next.push({
        key: "status",
        label: t("roles.filters.chipStatus", {
          value: statusLabels.join(", "),
        }),
      })
    }
    if (values.createdAtFrom || values.createdAtTo) {
      next.push({
        key: "createdAt",
        label: t("roles.filters.chipCreatedAt", {
          value: dateRangeText(values.createdAtFrom, values.createdAtTo, t),
        }),
      })
    }
    if (values.updatedAtFrom || values.updatedAtTo) {
      next.push({
        key: "updatedAt",
        label: t("roles.filters.chipUpdatedAt", {
          value: dateRangeText(values.updatedAtFrom, values.updatedAtTo, t),
        }),
      })
    }
    return next
  }, [values, t])

  // Stable identity: Base UI re-syncs its selection when `items` changes.
  const statusOptions = useMemo<FilterOption[]>(
    () => [
      { value: "active", label: t("roles.filters.statusActive") },
      { value: "inactive", label: t("roles.filters.statusInactive") },
    ],
    [t]
  )

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t("roles.filters.label")}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          aria-label={t("roles.filters.title")}
          placeholder={t("roles.filters.titlePlaceholder")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-56"
        />
        <Input
          aria-label={t("roles.filters.description")}
          placeholder={t("roles.filters.descriptionPlaceholder")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-56"
        />
        <FilterCombobox
          multiple
          options={statusOptions}
          value={values.status}
          onValueChange={(value) => commit({ status: value })}
          ariaLabel={t("roles.filters.status")}
          placeholder={t("roles.filters.status")}
          className="w-40"
        />
        <DateRangePicker
          id="roles-created-at-filter"
          aria-label={t("roles.filters.createdAt")}
          locale={locale}
          placeholder={t("roles.filters.createdPlaceholder")}
          clearLabel={t("roles.filters.dateClear")}
          value={{ from: values.createdAtFrom, to: values.createdAtTo }}
          onChange={(next) =>
            commit({
              createdAtFrom: next.from,
              createdAtTo: next.to,
            })
          }
        />
        <DateRangePicker
          id="roles-updated-at-filter"
          aria-label={t("roles.filters.updatedAt")}
          locale={locale}
          placeholder={t("roles.filters.updatedPlaceholder")}
          clearLabel={t("roles.filters.dateClear")}
          value={{ from: values.updatedAtFrom, to: values.updatedAtTo }}
          onChange={(next) =>
            commit({
              updatedAtFrom: next.from,
              updatedAtTo: next.to,
            })
          }
        />
      </div>

      {chips.length > 0 && (
        <div
          role="group"
          aria-label={t("roles.filters.activeFilters")}
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
                aria-label={t("roles.filters.removeFilter", {
                  filter: chip.label,
                })}
                onClick={() => removeFilter(chip.key)}
              >
                <XIcon className="pointer-events-none" />
              </Button>
            </span>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            {t("roles.filters.clearAll")}
          </Button>
        </div>
      )}
    </div>
  )
}
