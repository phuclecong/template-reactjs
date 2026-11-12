import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { enUS } from "react-day-picker/locale/en-US"
import { vi as viLocale } from "react-day-picker/locale/vi"

import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent } from "@workspace/ui/components/popover"
import { Sheet, SheetContent, SheetTitle } from "@workspace/ui/components/sheet"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  formatDate,
  localStartOfDayUtcInstant,
  parseUtcInstant,
} from "@workspace/ui/lib/date"

export type DatePickerProps = {
  /** The selected UTC instant (ISO 8601 with `Z`), or empty. */
  value?: string | null
  /** Receives the selected UTC instant, or `""` when cleared. */
  onChange?: (value: string) => void
  /** Inclusive lower bound as a UTC instant. */
  min?: string | null
  /** Inclusive upper bound as a UTC instant. */
  max?: string | null
  disabled?: boolean
  required?: boolean
  id?: string
  /** Renders a hidden named input carrying the selected instant. */
  name?: string
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  /** The app Locale (`"en"` or `"vi"`). */
  locale?: string
  placeholder?: string
  clearLabel?: string
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
 * A single-date picker built on the design system's Popover and Calendar
 * primitives. Values cross the component boundary as UTC instants; the
 * calendar and trigger operate on the viewer's local calendar day and format
 * through the requested Locale. On narrow viewports the calendar opens in a
 * sheet instead of a popover.
 */
export function DatePicker({
  value,
  onChange,
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
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ref,
}: DatePickerProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const selectedDate = React.useMemo(
    () => parseUtcInstant(value) ?? undefined,
    [value]
  )
  const displayValue = value ? formatDate(value, locale) : ""

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

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange?.("")
      setOpen(false)
      return
    }
    onChange?.(localStartOfDayUtcInstant(date))
    setOpen(false)
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
    onBlur,
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
      {value ? (
        <div className="border-t p-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange?.("")
              setOpen(false)
            }}
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </>
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
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
        <Popover open={open} onOpenChange={setOpen}>
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
