import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { CrudFilter } from "@refinedev/core"
import { XIcon } from "lucide-react"
import type { RoleStatus } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"
import { DateRangePicker } from "@workspace/ui/components/date-range-picker"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { resolveLocale } from "@workspace/ui/lib/date"

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

  // The last text values this bar committed. Comparing the incoming filter
  // state against them distinguishes our own URL echo (keep typing) from an
  // external change such as a chip removal, Clear all, or back/forward.
  const emittedTitle = useRef(values.title)
  const emittedDescription = useRef(values.description)

  const emit = useCallback(
    (next: RoleFilterValues) => {
      emittedTitle.current = next.title
      emittedDescription.current = next.description
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
    if (values.title !== emittedTitle.current) {
      emittedTitle.current = values.title
      setTitle(values.title)
    }
  }, [values.title])

  useEffect(() => {
    if (values.description !== emittedDescription.current) {
      emittedDescription.current = values.description
      setDescription(values.description)
    }
  }, [values.description])

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
      if (key === "title") {
        emittedTitle.current = ""
        setTitle("")
      }
      if (key === "description") {
        emittedDescription.current = ""
        setDescription("")
      }
      emit(clearRoleFilter({ ...values, title, description }, key))
    },
    [emit, values, title, description]
  )

  const clearAll = useCallback(() => {
    emittedTitle.current = ""
    emittedDescription.current = ""
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
      next.push({
        key: "status",
        label: t("roles.filters.chipStatus", {
          value:
            values.status === "active"
              ? t("roles.filters.statusActive")
              : t("roles.filters.statusInactive"),
        }),
      })
    }
    if (values.createdAtFrom || values.createdAtTo) {
      next.push({
        key: "createdAt",
        label: t("roles.filters.chipCreatedAt", {
          value: dateRangeText(
            values.createdAtFrom,
            values.createdAtTo,
            t
          ),
        }),
      })
    }
    if (values.updatedAtFrom || values.updatedAtTo) {
      next.push({
        key: "updatedAt",
        label: t("roles.filters.chipUpdatedAt", {
          value: dateRangeText(
            values.updatedAtFrom,
            values.updatedAtTo,
            t
          ),
        }),
      })
    }
    return next
  }, [values, t])

  const dateLabels = useMemo(
    () => ({
      between: t("roles.filters.dateModes.between"),
      from: t("roles.filters.dateModes.from"),
      until: t("roles.filters.dateModes.until"),
      today: t("roles.filters.datePresets.today"),
      last7Days: t("roles.filters.datePresets.last7Days"),
      thisMonth: t("roles.filters.datePresets.thisMonth"),
      mode: t("roles.filters.dateMode"),
    }),
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
        <Select
          value={values.status || "all"}
          onValueChange={(value) =>
            commit({
              status:
                value === "all" ? "" : (value as RoleStatus),
            })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("roles.filters.status")}
            className="w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("roles.filters.statusAll")}
            </SelectItem>
            <SelectItem value="active">
              {t("roles.filters.statusActive")}
            </SelectItem>
            <SelectItem value="inactive">
              {t("roles.filters.statusInactive")}
            </SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          id="roles-created-at-filter"
          aria-label={t("roles.filters.createdAt")}
          locale={locale}
          placeholder={t("roles.filters.createdPlaceholder")}
          clearLabel={t("roles.filters.dateClear")}
          labels={dateLabels}
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
          labels={dateLabels}
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
