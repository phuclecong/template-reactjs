import * as React from "react"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { cn } from "cn"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  calendarLocale,
  dateOnlyToLocalDate,
  formatDateRange,
  localDateToDateOnly,
} from "@workspace/ui/lib/date"

/** A range of calendar dates. Either bound may be an empty string. */
export type DateRangeValue = {
  from: string
  to: string
}

/** Which bounds the picker lets the user edit. */
export type DateRangePickerMode = "between" | "from" | "until"

/** Built-in shortcuts available in Between mode. */
export type DateRangePreset = "today" | "last7Days" | "thisMonth"

/**
 * Strings the design system cannot translate itself. Call sites pass the
 * active locale's translations; missing entries fall back to English.
 */
export type DateRangePickerLabels = {
  between: string
  from: string
  until: string
  today: string
  last7Days: string
  thisMonth: string
  mode: string
}

export type DateRangePickerProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  disabled?: boolean
  id?: string
  locale?: string
  placeholder?: string
  clearLabel?: string
  className?: string
  labels?: Partial<DateRangePickerLabels>
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

const MODES: DateRangePickerMode[] = ["between", "from", "until"]
const PRESETS: DateRangePreset[] = ["today", "last7Days", "thisMonth"]

const DEFAULT_LABELS: DateRangePickerLabels = {
  between: "Between",
  from: "From",
  until: "Until",
  today: "Today",
  last7Days: "Last 7 days",
  thisMonth: "This month",
  mode: "Filter mode",
}

/**
 * Computes the local calendar-date bounds for a preset. `now` is injectable
 * so the preset semantics can be pinned in tests; the picker uses the runtime
 * clock and therefore the viewer's local day.
 */
export function getPresetDateRange(
  preset: DateRangePreset,
  now: Date = new Date()
): DateRangeValue {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === "today") {
    const value = localDateToDateOnly(today)
    return { from: value, to: value }
  }

  if (preset === "last7Days") {
    const start = new Date(today)
    start.setDate(today.getDate() - 6)
    return {
      from: localDateToDateOnly(start),
      to: localDateToDateOnly(today),
    }
  }

  return {
    from: localDateToDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localDateToDateOnly(
      new Date(today.getFullYear(), today.getMonth() + 1, 0)
    ),
  }
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
 * Date-granular range filter. The value is date-only strings so call sites can
 * keep the `dueFrom`/`dueTo` URL keys; the popover calendar is the only
 * selection surface. Modes restrict which bounds are editable, and Between
 * mode adds common presets.
 */
export const DateRangePicker = React.forwardRef<
  HTMLButtonElement,
  DateRangePickerProps
>(function DateRangePicker(
  {
    value,
    onChange,
    disabled = false,
    id,
    locale = "en",
    placeholder = "",
    clearLabel = "Clear",
    className,
    labels,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
  },
  ref
) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<DateRangePickerMode>("between")

  const text = React.useMemo(
    () => formatDateRange(value.from, value.to, locale),
    [value.from, value.to, locale]
  )

  const mergedLabels: DateRangePickerLabels = {
    ...DEFAULT_LABELS,
    ...labels,
  }

  const selected = React.useMemo(
    () => toCalendarSelection(mode, value.from, value.to),
    [mode, value.from, value.to]
  )
  const displayMonth = React.useMemo(
    () =>
      dateOnlyToLocalDate(value.from) ??
      dateOnlyToLocalDate(value.to) ??
      undefined,
    [value.from, value.to]
  )

  // Dropdown bounds only need to be stable across renders; recomputing them
  // every render churned the calendar's navigation model.
  const { startMonth, endMonth } = React.useMemo(() => {
    const now = new Date()
    return {
      startMonth: new Date(now.getFullYear() - 5, 0, 1),
      endMonth: new Date(now.getFullYear() + 5, 11, 31),
    }
  }, [])

  function changeMode(next: DateRangePickerMode) {
    setMode(next)
    const nextValue: DateRangeValue =
      next === "from"
        ? { from: value.from, to: "" }
        : next === "until"
          ? { from: "", to: value.to }
          : value
    if (nextValue.from !== value.from || nextValue.to !== value.to) {
      onChange(nextValue)
    }
  }

  function selectRange(_range: DateRange | undefined, triggerDate: Date) {
    const picked = localDateToDateOnly(triggerDate)

    if (mode === "from") {
      onChange({ from: picked, to: "" })
      setOpen(false)
      return
    }

    if (mode === "until") {
      onChange({ from: "", to: picked })
      setOpen(false)
      return
    }

    // Between mode. A click with no start, or with a complete range, starts a
    // new range. A click before an incomplete start restarts it; the next
    // click at or after the start completes the range.
    if (!value.from || value.to || picked < value.from) {
      onChange({ from: picked, to: "" })
      return
    }

    onChange({ from: value.from, to: picked })
    setOpen(false)
  }

  function applyPreset(preset: DateRangePreset) {
    onChange(getPresetDateRange(preset))
    setOpen(false)
  }

  function clear() {
    onChange({ from: "", to: "" })
  }

  const trigger = (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      className={cn(
        "h-8 w-56 justify-between gap-2 font-normal",
        className
      )}
    >
      <span className={cn("truncate", !text && "text-muted-foreground")}>
        {text || placeholder}
      </span>
      <CalendarIcon className="size-3.5 shrink-0 opacity-60" />
    </Button>
  )

  const content = (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={mergedLabels.mode}
        className="flex flex-wrap gap-1"
      >
        {MODES.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={mode === option ? "secondary" : "ghost"}
            aria-pressed={mode === option}
            onClick={() => changeMode(option)}
          >
            {mergedLabels[option]}
          </Button>
        ))}
      </div>

      {mode === "between" && (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => applyPreset(preset)}
            >
              {mergedLabels[preset]}
            </Button>
          ))}
        </div>
      )}

      <Calendar
        mode="range"
        selected={selected}
        defaultMonth={displayMonth}
        onSelect={selectRange}
        numberOfMonths={isMobile ? 1 : 2}
        locale={calendarLocale(locale)}
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={endMonth}
        autoFocus
      />

      <div className="flex justify-end border-t pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          {clearLabel}
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={trigger} />
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-3">
          <SheetTitle className="sr-only">
            {ariaLabel ?? placeholder}
          </SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-auto p-2">
        {content}
      </PopoverContent>
    </Popover>
  )
})
