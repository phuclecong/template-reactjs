import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { isValid, parse } from "date-fns"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { enUS } from "react-day-picker/locale/en-US"
import { vi as viLocale } from "react-day-picker/locale/vi"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent } from "@workspace/ui/components/popover"
import { Sheet, SheetContent, SheetTitle } from "@workspace/ui/components/sheet"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { formatDateTime, parseUtcInstant } from "@workspace/ui/lib/date"

/**
 * The fixed format accepted by the free-text entry. Display and the calendar
 * stay locale-aware; the typed field is deliberately explicit so the same
 * characters mean the same thing in every Locale.
 */
export const DATE_PICKER_TYPED_FORMAT = "yyyy-MM-dd HH:mm"

const TYPED_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** Formats a local Date as the `HH:mm` value a time input expects. */
function toLocalTimeValue(date: Date | null): string {
  if (!date) return ""
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Formats a local Date as the fixed typed-entry format. */
function toTypedValue(date: Date | null): string {
  if (!date) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Builds the instant for a local calendar day and wall-clock time. */
function localDateTimeToInstant(
  date: Date,
  hours: number,
  minutes: number
): string {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  ).toISOString()
}

/**
 * Parses the fixed typed-entry format in the viewer's local timezone. The
 * regex keeps date-fns's lenient parser from accepting variants such as
 * `2026-1-2 3:4`; an invalid calendar date or time is rejected.
 */
function parseTypedValue(value: string): Date | null {
  const text = value.trim()
  if (!TYPED_PATTERN.test(text)) return null
  const date = parse(text, DATE_PICKER_TYPED_FORMAT, new Date())
  return isValid(date) ? date : null
}

export type DatePickerProps = {
  /** The selected UTC instant (ISO 8601 with `Z`), or empty. */
  value?: string | null
  /** Receives the selected UTC instant, or `""` when cleared. */
  onChange?: (value: string) => void
  /**
   * Called after the user presses Done, with the value at that moment. Changes
   * still apply through `onChange` as they happen; this is the completion
   * signal call sites that defer a write (such as the bulk action) need.
   */
  onDone?: (value: string) => void
  /** Called whenever the picker opens or closes. */
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
  clearLabel?: string
  doneLabel?: string
  timeLabel?: string
  typedEntryLabel?: string
  typedEntryHint?: string
  typedEntryError?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function calendarLocale(locale: string) {
  return locale === "vi" ? viLocale : enUS
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
 * On narrow viewports the picker opens in a sheet instead of a popover.
 */
export function DatePicker({
  value,
  onChange,
  onDone,
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
  clearLabel = "Clear",
  doneLabel = "Done",
  timeLabel = "Time",
  typedEntryLabel = "Date and time",
  typedEntryHint = "Format: yyyy-MM-dd HH:mm",
  typedEntryError = "Enter a valid date and time.",
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ref,
}: DatePickerProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const [open, setOpen] = React.useState(false)
  const [typedValue, setTypedValue] = React.useState("")
  const [typedInvalid, setTypedInvalid] = React.useState(false)
  const isMobile = useIsMobile()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const timeId = React.useId()
  const typedId = React.useId()
  const typedHintId = React.useId()
  const typedErrorId = React.useId()

  const selectedDate = React.useMemo(
    () => parseUtcInstant(value) ?? undefined,
    [value]
  )
  const displayValue = value ? formatDateTime(value, locale) : ""
  const timeValue = toLocalTimeValue(selectedDate ?? null)

  // Keep the typed field in step with the calendar and time controls, and
  // reset any error when the popover reopens.
  React.useEffect(() => {
    if (!open) return
    setTypedValue(toTypedValue(selectedDate ?? null))
    setTypedInvalid(false)
  }, [open, selectedDate])

  // min/max are UTC instants, but the picker selects calendar days. Treat the
  // bound's local calendar day as the inclusive edge so a bound that carries a
  // time still keeps its whole day selectable.
  const disabledMatchers = React.useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = []
    const minDate = parseUtcInstant(min)
    const maxDate = parseUtcInstant(max)
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
  }, [min, max])

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
    setOpen(next)
    if (next) onOpenChange?.(true)
    else finishClose()
  }

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange?.("")
      return
    }
    // Preserve the selected wall-clock time; a value created from empty
    // starts at 00:00 local.
    const hours = selectedDate?.getHours() ?? 0
    const minutes = selectedDate?.getMinutes() ?? 0
    onChange?.(localDateTimeToInstant(date, hours, minutes))
  }

  function handleTimeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    if (!raw || !selectedDate) return
    const [hoursPart = "", minutesPart = ""] = raw.split(":")
    const hours = Number(hoursPart)
    const minutes = Number(minutesPart)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return
    onChange?.(localDateTimeToInstant(selectedDate, hours, minutes))
  }

  /**
   * Resolves the typed field into an instant. It returns the current `value`
   * unchanged when the field is empty or invalid, so Done never emits a
   * corrupt value.
   */
  function resolveTypedValue(): { value: string | null; invalid: boolean } {
    const text = typedValue.trim()
    if (!text) return { value: value || null, invalid: false }
    const parsed = parseTypedValue(text)
    if (!parsed) return { value: value || null, invalid: true }
    return { value: parsed.toISOString(), invalid: false }
  }

  function commitTypedValue() {
    const resolved = resolveTypedValue()
    setTypedInvalid(resolved.invalid)
    if (!resolved.invalid && resolved.value && resolved.value !== value) {
      onChange?.(resolved.value)
    }
  }

  function handleDone() {
    const resolved = resolveTypedValue()
    setTypedInvalid(resolved.invalid)
    if (!resolved.invalid && resolved.value && resolved.value !== value) {
      onChange?.(resolved.value)
    }
    onDone?.(resolved.value ?? "")
    setOpen(false)
    finishClose()
  }

  function handleClear() {
    onChange?.("")
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
        selected={selectedDate}
        onSelect={handleSelect}
        defaultMonth={selectedDate}
        locale={calendarLocale(locale)}
        disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
        autoFocus
      />
      <div className="flex flex-col gap-2 border-t p-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={timeId} className="text-muted-foreground">
            {timeLabel}
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
            {typedEntryLabel}
          </label>
          <input
            id={typedId}
            type="text"
            value={typedValue}
            placeholder={DATE_PICKER_TYPED_FORMAT}
            aria-invalid={typedInvalid || undefined}
            aria-describedby={typedInvalid ? typedErrorId : typedHintId}
            onChange={(event) => {
              setTypedValue(event.target.value)
              if (typedInvalid) setTypedInvalid(false)
            }}
            onBlur={commitTypedValue}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              commitTypedValue()
            }}
            className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30"
          />
          {typedInvalid ? (
            <p id={typedErrorId} role="alert" className="text-destructive">
              {typedEntryError}
            </p>
          ) : (
            <p id={typedHintId} className="text-muted-foreground">
              {typedEntryHint}
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
              {clearLabel}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={handleDone}>
            {doneLabel}
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
