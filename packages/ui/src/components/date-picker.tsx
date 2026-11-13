import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { FocusableCalendarDayButton } from "@workspace/ui/components/calendar-focus"
import { Popover, PopoverContent } from "@workspace/ui/components/popover"
import { Sheet, SheetContent, SheetTitle } from "@workspace/ui/components/sheet"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  calendarLocale,
  formatDateTime,
  formatTimeInputValue,
  formatTypedDateTime,
  localDateTimeToUtcInstant,
  parseTypedDateTime,
  parseUtcInstant,
  typedDateTimeFormatHint,
} from "@workspace/ui/lib/date"

/** Strings the design system cannot translate itself. */
export type DatePickerLabels = {
  clear: string
  done: string
  time: string
  typedEntryLabel: string
  /** May contain a `{format}` placeholder for the localized example. */
  typedEntryHint: string
  typedEntryError: string
}

const DEFAULT_LABELS: DatePickerLabels = {
  clear: "Clear",
  done: "Done",
  time: "Time",
  typedEntryLabel: "Date and time",
  typedEntryHint: "Format: {format}",
  typedEntryError: "Enter a valid date and time.",
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export type DatePickerProps = {
  /** The selected UTC instant (ISO 8601 with `Z`), or empty. */
  value?: string | null
  /** Receives the selected UTC instant, or `""` when cleared. */
  onChange?: (value: string) => void
  /**
   * Called whenever the picker opens or closes. Call sites that keep a local
   * draft (such as the bulk action) use the close signal to reset it.
   */
  onOpenChange?: (open: boolean) => void
  /** Inclusive lower bound as a UTC instant. */
  min?: string | null
  /** Inclusive upper bound as a UTC instant. */
  max?: string | null
  disabled?: boolean
  required?: boolean
  id?: string
  /** Renders a hidden named input carrying the selected instant. */
  name?: string
  onBlur?: (event?: React.FocusEvent<HTMLButtonElement>) => void
  /** The app Locale (`"en"` or `"vi"`). */
  locale?: string
  placeholder?: string
  labels?: Partial<DatePickerLabels>
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") ref(node)
      else ref.current = node
    }
  }
}

/**
 * A single date-and-time picker built on the design system's Popover and
 * Calendar primitives. Values cross the component boundary as UTC instants;
 * the calendar, time control, and typed entry operate on the viewer's local
 * calendar day and format through the requested Locale. Picking a date keeps
 * the selected time (defaulting to 00:00), and the popover stays open until
 * Done, Esc, or an outside click so a full datetime can be set in one action.
 * On narrow or touch viewports the picker opens in a sheet instead.
 */
export function DatePicker({
  value,
  onChange,
  onOpenChange,
  min,
  max,
  disabled = false,
  required = false,
  id,
  name,
  onBlur,
  locale = "en",
  placeholder = "",
  labels,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ref,
}: DatePickerProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const [open, setOpen] = React.useState(false)
  const [typedDraft, setTypedDraft] = React.useState<string | null>(null)
  const [typedInvalid, setTypedInvalid] = React.useState(false)
  const isMobile = useIsMobile()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const timeId = React.useId()
  const typedId = React.useId()
  const typedHintId = React.useId()
  const typedErrorId = React.useId()

  const mergedLabels: DatePickerLabels = { ...DEFAULT_LABELS, ...labels }

  const selectedDate = React.useMemo(
    () => parseUtcInstant(value) ?? undefined,
    [value]
  )
  const minDate = React.useMemo(() => parseUtcInstant(min), [min])
  const maxDate = React.useMemo(() => parseUtcInstant(max), [max])
  const now = React.useMemo(() => new Date(), [])

  // The typed field is derived while the user has not typed anything, so a
  // calendar or time change is reflected without an effect copying state.
  const typedValue =
    typedDraft ?? formatTypedDateTime(selectedDate ?? null, locale)
  const typedFormatHint = React.useMemo(
    () => typedDateTimeFormatHint(locale),
    [locale]
  )
  const typedHint = mergedLabels.typedEntryHint.replace(
    "{format}",
    typedFormatHint
  )
  const displayValue = value ? formatDateTime(value, locale) : ""
  const timeValue = formatTimeInputValue(selectedDate ?? null)

  // min/max are UTC instants, but the picker selects calendar days. Treat the
  // bound's local calendar day as the inclusive edge so a bound that carries a
  // time still keeps its whole day selectable.
  const disabledMatchers = React.useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = []
    if (minDate) {
      matchers.push({
        before: new Date(
          minDate.getFullYear(),
          minDate.getMonth(),
          minDate.getDate()
        ),
      })
    }
    if (maxDate) {
      matchers.push({
        after: new Date(
          maxDate.getFullYear(),
          maxDate.getMonth(),
          maxDate.getDate()
        ),
      })
    }
    return matchers
  }, [minDate, maxDate])

  // Derive the dropdown year bounds from the allowed instants and clamp the
  // opening month into them. Without bounds, offer five years either side of
  // the selected day (or today) so the dropdown stays usable.
  const monthBounds = React.useMemo(() => {
    const anchor = selectedDate ?? minDate ?? maxDate ?? now
    const startMonth = minDate
      ? startOfMonth(minDate)
      : startOfMonth(new Date(anchor.getFullYear() - 5, 0, 1))
    let endMonth = maxDate
      ? endOfMonth(maxDate)
      : endOfMonth(new Date(anchor.getFullYear() + 5, 11, 31))
    if (endMonth < startMonth) endMonth = endOfMonth(startMonth)

    const target = selectedDate ?? now
    const defaultMonth =
      target < startMonth ? startMonth : target > endMonth ? endMonth : target

    return { startMonth, endMonth, defaultMonth }
  }, [selectedDate, minDate, maxDate, now])

  function isWithinBounds(date: Date): boolean {
    if (minDate && date.getTime() < minDate.getTime()) return false
    if (maxDate && date.getTime() > maxDate.getTime()) return false
    return true
  }

  function resetTypedEntry() {
    setTypedDraft(null)
    setTypedInvalid(false)
  }

  // Base UI otherwise focuses the first tabbable element (the month
  // navigation), so point it at the calendar's current day button instead.
  // react-day-picker marks the focusable day with `tabindex="0"`.
  const focusCalendarDay = React.useCallback(() => {
    return document.querySelector<HTMLElement>(
      '[data-slot="calendar"] [data-day][tabindex="0"]'
    )
  }, [])

  /**
   * Notifies the caller, reports blur, and returns focus to the trigger. The
   * focus is deferred so it wins over the browser focusing the element that
   * was clicked to dismiss the popover.
   */
  function finishClose() {
    onOpenChange?.(false)
    onBlur?.()
    queueMicrotask(() => triggerRef.current?.focus())
  }

  function handleOpenChange(next: boolean) {
    resetTypedEntry()
    setOpen(next)
    if (next) onOpenChange?.(true)
    else finishClose()
  }

  function handleSelect(date: Date | undefined) {
    // The calendar is `required`, and clicking the already-selected day must
    // do nothing; clearing stays an explicit action.
    if (!date || (selectedDate && sameCalendarDay(date, selectedDate))) return
    resetTypedEntry()
    // Preserve the selected wall-clock time; a value created from empty
    // starts at 00:00 local.
    const hours = selectedDate?.getHours() ?? 0
    const minutes = selectedDate?.getMinutes() ?? 0
    onChange?.(localDateTimeToUtcInstant(date, hours, minutes))
  }

  function handleTimeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    if (!raw || !selectedDate) return
    const [hoursPart = "", minutesPart = ""] = raw.split(":")
    const hours = Number(hoursPart)
    const minutes = Number(minutesPart)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return
    resetTypedEntry()
    onChange?.(localDateTimeToUtcInstant(selectedDate, hours, minutes))
  }

  /**
   * Resolves the typed field into an instant. Empty or invalid text keeps the
   * current value, so committing never emits a corrupt or out-of-range value.
   */
  function resolveTypedValue(): { value: string | null; invalid: boolean } {
    const text = typedValue.trim()
    if (!text) return { value: value || null, invalid: false }
    const parsed = parseTypedDateTime(text, locale)
    if (!parsed || !isWithinBounds(parsed)) {
      return { value: value || null, invalid: true }
    }
    return { value: parsed.toISOString(), invalid: false }
  }

  /** Resolves the typed field, reports any error, and emits a changed value. */
  function commitTypedValue(): string | null {
    const resolved = resolveTypedValue()
    setTypedInvalid(resolved.invalid)
    if (resolved.invalid) return null
    if (resolved.value && resolved.value !== value) {
      onChange?.(resolved.value)
    }
    return resolved.value
  }

  function handleDone() {
    commitTypedValue()
    setOpen(false)
    finishClose()
  }

  function handleClear() {
    onChange?.("")
    resetTypedEntry()
    setOpen(false)
    finishClose()
  }

  const triggerClassName = cn(
    "flex h-8 w-full min-w-0 items-center gap-2 rounded-none border border-input bg-transparent px-2.5 py-1 text-left text-xs transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    className
  )

  const triggerContent = (
    <>
      <span
        className={cn(
          "flex-1 truncate",
          !displayValue && "text-muted-foreground"
        )}
      >
        {displayValue || placeholder}
      </span>
      <CalendarIcon className="size-4 shrink-0 opacity-60" />
    </>
  )

  const triggerAria = {
    id,
    type: "button" as const,
    disabled,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid || undefined,
    "aria-describedby": ariaDescribedBy,
    "aria-required": required || undefined,
    // While the popover is open, focus lives inside it; the field's blur is
    // reported when the popover closes instead.
    onBlur: () => {
      if (!open) onBlur?.()
    },
    className: triggerClassName,
  }

  const calendarContent = (
    <>
      <Calendar
        mode="single"
        required
        selected={selectedDate}
        onSelect={handleSelect}
        defaultMonth={monthBounds.defaultMonth}
        locale={calendarLocale(locale)}
        disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
        captionLayout="dropdown"
        startMonth={monthBounds.startMonth}
        endMonth={monthBounds.endMonth}
        components={{ DayButton: FocusableCalendarDayButton }}
        autoFocus
      />
      <div className="flex flex-col gap-2 border-t p-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={timeId} className="text-muted-foreground">
            {mergedLabels.time}
          </label>
          <input
            id={timeId}
            type="time"
            value={timeValue}
            disabled={!selectedDate}
            onChange={handleTimeChange}
            className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={typedId} className="text-muted-foreground">
            {mergedLabels.typedEntryLabel}
          </label>
          <input
            id={typedId}
            type="text"
            value={typedValue}
            placeholder={typedFormatHint}
            aria-invalid={typedInvalid || undefined}
            aria-describedby={typedInvalid ? typedErrorId : typedHintId}
            onChange={(event) => {
              setTypedDraft(event.target.value)
              if (typedInvalid) setTypedInvalid(false)
            }}
            onBlur={() => commitTypedValue()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              commitTypedValue()
            }}
            className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30"
          />
          {typedInvalid ? (
            <p id={typedErrorId} role="alert" className="text-destructive">
              {mergedLabels.typedEntryError}
            </p>
          ) : (
            <p id={typedHintId} className="text-muted-foreground">
              {typedHint}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
            >
              {mergedLabels.clear}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={handleDone}>
            {mergedLabels.done}
          </Button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <DialogPrimitive.Trigger
            ref={mergeRefs(triggerRef, ref)}
            {...triggerAria}
          >
            {triggerContent}
          </DialogPrimitive.Trigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="gap-0"
            initialFocus={focusCalendarDay}
          >
            <SheetTitle className="sr-only">
              {ariaLabel ?? placeholder ?? "Date"}
            </SheetTitle>
            {calendarContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverPrimitive.Trigger
            ref={mergeRefs(triggerRef, ref)}
            {...triggerAria}
          >
            {triggerContent}
          </PopoverPrimitive.Trigger>
          <PopoverContent
            className="w-auto p-0"
            initialFocus={focusCalendarDay}
          >
            {calendarContent}
          </PopoverContent>
        </Popover>
      )}
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </>
  )
}
