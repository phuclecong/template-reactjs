import * as React from "react"
import { useDayPicker } from "react-day-picker"

import { CalendarDayButton } from "@workspace/ui/components/calendar"

type CalendarDayButtonProps = React.ComponentProps<typeof CalendarDayButton>

/**
 * Repo-owned focus seam shared by the two date pickers.
 *
 * Registry 4.23.0's `CalendarDayButton` declares a ref for its keyboard-focus
 * effect but never attaches it to the rendered button, so changing the focused
 * day with the Arrow keys updates `data-focused` without moving DOM focus.
 * React 19 treats `ref` as an ordinary prop, so supplying one here reaches Base
 * UI's button through the registry component's prop spread and restores the
 * day-button focus effect the date pickers rely on.
 */
export function FocusableCalendarDayButton(props: CalendarDayButtonProps) {
  const { dayPickerProps } = useDayPicker()
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (props.modifiers?.focused) ref.current?.focus()
  }, [props.modifiers?.focused])

  const buttonProps = {
    ...props,
    locale: dayPickerProps.locale,
    ref,
  }

  return <CalendarDayButton {...buttonProps} />
}
