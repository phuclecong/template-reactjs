import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DateRangePicker,
  type DateRangePickerProps,
  type DateRangeValue,
} from "./date-range-picker"

const emptyValue: DateRangeValue = { from: "", to: "" }

function Harness({
  initial = emptyValue,
  onChange,
  ...props
}: Omit<Partial<DateRangePickerProps>, "value" | "onChange"> & {
  initial?: DateRangeValue
  onChange?: (value: DateRangeValue) => void
}) {
  const [value, setValue] = React.useState(initial)

  return (
    <DateRangePicker
      {...props}
      aria-label="Due date"
      placeholder="Any due date"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

/** Freezes the clock (but not timers) so preset expectations are literal. */
function freezeClock(date: Date) {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(date)
}

afterEach(() => {
  vi.useRealTimers()
})

describe("DateRangePicker display", () => {
  it("shows the placeholder when no bound is set", () => {
    const { container } = render(<Harness />)

    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Any due date")
    expect(container.querySelector("input[name]")).toBeNull()
  })

  it("shows a full range in the locale-aware format", () => {
    render(
      <Harness initial={{ from: "2026-01-05", to: "2026-01-10" }} locale="en" />
    )
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent(/Jan 5.*10, 2026/)
  })

  it("shows a lower bound only", () => {
    render(
      <Harness initial={{ from: "2026-01-05", to: "" }} locale="en" />
    )
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Jan 5, 2026")
  })

  it("shows an upper bound only", () => {
    render(
      <Harness initial={{ from: "", to: "2026-01-05" }} locale="en" />
    )
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Jan 5, 2026")
  })

  it("formats the range for the Vietnamese locale", () => {
    render(
      <Harness initial={{ from: "2026-01-05", to: "2026-01-10" }} locale="vi" />
    )
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent(/5.*10 thg 1, 2026/)
  })
})

describe("DateRangePicker interactions", () => {
  it("selects a custom range and closes when the range is complete", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    expect(document.querySelectorAll(".rdp-month")).toHaveLength(2)
    await user.click(
      screen.getByRole("button", { name: /January 5th, 2026/ })
    )
    await user.click(
      screen.getByRole("button", { name: /January 8th, 2026/ })
    )

    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-05",
      to: "2026-01-08",
    })
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent(/Jan 5.*8, 2026/)
  })

  it("restarts the range when a day before the start is clicked", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(
      screen.getByRole("button", { name: /January 5th, 2026/ })
    )
    await user.click(
      screen.getByRole("button", { name: /January 3rd, 2026/ })
    )

    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-03",
      to: "",
    })
  })

  it("applies the Between presets as local date-only bounds", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(screen.getByRole("button", { name: "Today" }))
    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-10",
      to: "2026-01-10",
    })

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(screen.getByRole("button", { name: "Last 7 days" }))
    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-04",
      to: "2026-01-10",
    })

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(screen.getByRole("button", { name: "This month" }))
    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-01",
      to: "2026-01-31",
    })
  })

  it("emits an upper bound only in Until mode", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(screen.getByRole("button", { name: "Until" }))
    await user.click(
      screen.getByRole("button", { name: /January 3rd, 2026/ })
    )

    expect(onChange).toHaveBeenLastCalledWith({
      from: "",
      to: "2026-01-03",
    })
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Jan 3, 2026")
  })

  it("emits a lower bound only in From mode", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(screen.getByRole("button", { name: "From" }))
    await user.click(
      screen.getByRole("button", { name: /January 3rd, 2026/ })
    )

    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-03",
      to: "",
    })
  })

  it("clears both bounds without closing the popover", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ from: "2026-01-05", to: "2026-01-10" }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(screen.getByRole("button", { name: "Clear" }))

    expect(onChange).toHaveBeenLastCalledWith({ from: "", to: "" })
    expect(
      screen.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Any due date")
    expect(
      screen.getByRole("button", { name: "Between" })
    ).toBeInTheDocument()
  })

  it("selects a range with the keyboard and returns focus to the trigger", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const trigger = screen.getByRole("button", { name: "Due date" })
    trigger.focus()
    await user.keyboard("{Enter}")
    await user.keyboard("{Enter}")
    await user.keyboard("{ArrowRight}")
    await user.keyboard("{Enter}")

    expect(onChange).toHaveBeenLastCalledWith({
      from: "2026-01-10",
      to: "2026-01-11",
    })
    expect(trigger).toHaveFocus()
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup()
    freezeClock(new Date(2026, 0, 10, 12, 0, 0))
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const trigger = screen.getByRole("button", { name: "Due date" })
    await user.click(trigger)
    expect(
      await screen.findByRole("button", { name: "Between" })
    ).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(
      screen.queryByRole("button", { name: "Between" })
    ).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })

  it("does not open when disabled", async () => {
    const user = userEvent.setup()
    render(<Harness disabled />)

    const trigger = screen.getByRole("button", { name: "Due date" })
    expect(trigger).toBeDisabled()

    await user.click(trigger)
    expect(
      screen.queryByRole("button", { name: "Between" })
    ).not.toBeInTheDocument()
  })
})

describe("DateRangePicker narrow viewports", () => {
  it("opens a one-month sheet on a narrow viewport", async () => {
    const user = userEvent.setup()
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 500,
    })

    try {
      render(<Harness />)
      await user.click(screen.getByRole("button", { name: "Due date" }))

      expect(await screen.findByRole("dialog")).toBeInTheDocument()
      await waitFor(() =>
        expect(document.querySelectorAll(".rdp-month")).toHaveLength(1)
      )
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: originalWidth,
      })
    }
  })
})
