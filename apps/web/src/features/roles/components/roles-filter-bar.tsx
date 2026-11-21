import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CrudFilter } from "@refinedev/core"
import { XIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  DateRangeFilter,
  ComboboxFilter,
} from "@workspace/shared-lib/components"
import { useEnums } from "@workspace/shared-lib/hooks"

import {
  clearRoleFilter,
  roleFilterChips,
  roleFiltersFromCrud,
  roleFiltersToCrud,
  type RoleFilterKey,
  type RoleFilterValues,
} from "@/features/roles/utils/filters"

/** Text filters commit only after the user pauses for this long. */
export const TEXT_FILTER_DEBOUNCE_MS = 300

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
  const { t } = useTranslation()
  const values = useMemo(() => roleFiltersFromCrud(filters), [filters])
  const { ROLE_STATUS_OPTIONS: statusOptions } = useEnums()

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

  const chips = useMemo(
    () => roleFilterChips(values, { t, statusOptions }),
    [values, statusOptions, t]
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
        <ComboboxFilter
          multiple
          options={statusOptions}
          value={values.status}
          onValueChange={(value) => commit({ status: value })}
          ariaLabel={t("roles.filters.status")}
          placeholder={t("roles.filters.status")}
          className="w-40"
        />
        <DateRangeFilter
          id="roles-created-at-filter"
          ariaLabel={t("roles.filters.createdAt")}
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
        <DateRangeFilter
          id="roles-updated-at-filter"
          ariaLabel={t("roles.filters.updatedAt")}
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
