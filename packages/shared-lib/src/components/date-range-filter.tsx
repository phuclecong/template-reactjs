import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  DateRangePicker,
  type DateRangeValue,
} from "@workspace/ui/components/date-range-picker"
import { resolveLocale } from "@workspace/ui/lib/date"

export type DateRangeFilterProps = {
  id?: string
  /** Translated accessible name, for example "Created date". */
  ariaLabel: string
  /** Translated empty-state prompt, for example "Any created date". */
  placeholder?: string
  /** Translated clear control label. */
  clearLabel?: string
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
}

/**
 * Locale-aware date-range filter. The mode and preset chrome is shared UI copy
 * rather than feature data, so this component owns the `dateRange.*`
 * translations; callers pass only the feature-specific label, placeholder,
 * clear label, and value wiring.
 */
export function DateRangeFilter({
  id,
  ariaLabel,
  placeholder,
  clearLabel,
  value,
  onChange,
}: DateRangeFilterProps) {
  const { t, i18n } = useTranslation()
  const labels = useMemo(
    () => ({
      between: t("dateRange.modes.between"),
      from: t("dateRange.modes.from"),
      until: t("dateRange.modes.until"),
      today: t("dateRange.presets.today"),
      last7Days: t("dateRange.presets.last7Days"),
      thisMonth: t("dateRange.presets.thisMonth"),
      mode: t("dateRange.mode"),
    }),
    [t]
  )

  return (
    <DateRangePicker
      id={id}
      aria-label={ariaLabel}
      locale={resolveLocale(i18n.language)}
      placeholder={placeholder}
      clearLabel={clearLabel}
      labels={labels}
      value={value}
      onChange={onChange}
    />
  )
}
