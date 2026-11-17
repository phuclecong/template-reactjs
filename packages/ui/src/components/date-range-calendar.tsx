import * as React from "react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@workspace/ui/components/calendar"
import { FocusableCalendarDayButton } from "@workspace/ui/components/calendar-focus"
import { calendarLocale, dateOnlyToLocalDate } from "@workspace/ui/lib/date"

import type { DateRangePickerMode } from "./date-range-picker"

type DateRangeCalendarProps = {
  mode: DateRangePickerMode
  from: string
  to: string
  locale: string
  numberOfMonths: number
  defaultMonth?: Date
  startMonth: Date
  endMonth: Date
  onSelect: (range: DateRange | undefined, triggerDate: Date) => void
}

function toCalendarSelection(
  mode: DateRangePickerMode,
  fromValue: string,
  toValue: string
): DateRange | undefined {
  if (mode === "from") {
    const from = dateOnlyToLocalDate(fromValue)
    return from ? { from, to: undefined } : undefined
  }

  if (mode === "until") {
    const to = dateOnlyToLocalDate(toValue)
    return to ? { from: undefined, to } : undefined
  }

  const from = dateOnlyToLocalDate(fromValue) ?? undefined
  const to = dateOnlyToLocalDate(toValue) ?? undefined
  return from || to ? { from, to } : undefined
}

/**
 * The calendar body of the range picker, split into its own module so
 * `react-day-picker` (and the calendar UI) load only when a picker opens.
 * Table routes render the filter bar on first paint; the picker itself is
 * opened on demand, so its ~13 kB gzip stays out of the initial byte budget.
 */
export default function DateRangeCalendar({
  mode,
  from,
  to,
  locale,
  numberOfMonths,
  defaultMonth,
  startMonth,
  endMonth,
  onSelect,
}: DateRangeCalendarProps) {
  const selected = React.useMemo(
    () => toCalendarSelection(mode, from, to),
    [mode, from, to]
  )

  return (
    <Calendar
      mode="range"
      selected={selected}
      defaultMonth={defaultMonth}
      onSelect={onSelect}
      numberOfMonths={numberOfMonths}
      locale={calendarLocale(locale)}
      captionLayout="dropdown"
      startMonth={startMonth}
      endMonth={endMonth}
      components={{ DayButton: FocusableCalendarDayButton }}
      autoFocus
    />
  )
}
