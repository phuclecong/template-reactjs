import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DatePicker } from "./date-picker"

const originalTimeZone = process.env.TZ

beforeEach(() => {
  process.env.TZ = "UTC"
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

function startOfLocalToday(): string {
  const now = new Date()
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).toISOString()
}

describe("DatePicker", () => {
  it("selects a date and emits a UTC instant at local midnight", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={onChange}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(await screen.findByRole("button", { name: /January 20/ }))

    expect(onChange).toHaveBeenCalledWith("2026-01-20T00:00:00.000Z")
  })

  it("shows the placeholder when there is no value", () => {
    render(<DatePicker placeholder="Pick a date" aria-label="Due date" />)

    expect(screen.getByRole("button", { name: "Due date" })).toHaveTextContent(
      "Pick a date"
    )
  })

  it("shows the locale-aware date and time in the trigger", () => {
    render(
      <DatePicker
        value="2026-01-15T14:30:00.000Z"
        locale="vi"
        aria-label="Due date"
      />
    )

    expect(screen.getByRole("button", { name: "Due date" })).toHaveTextContent(
      "14:30 15 thg 1, 2026"
    )
  })

  it("keeps the popover open after a date pick so the time can be adjusted", async () => {
    const user = userEvent.setup()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={vi.fn()}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(await screen.findByRole("button", { name: /January 20/ }))

    expect(screen.getByLabelText("Time")).toBeInTheDocument()
  })

  it("preserves the selected time when the date changes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T09:30:00.000Z"
        onChange={onChange}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(await screen.findByRole("button", { name: /January 20/ }))

    expect(onChange).toHaveBeenCalledWith("2026-01-20T09:30:00.000Z")
  })

  it("defaults a value created from empty to local midnight", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DatePicker onChange={onChange} aria-label="Due date" />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))

    expect(onChange).toHaveBeenCalledWith(startOfLocalToday())
  })

  it("updates the time while keeping the selected date", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T09:30:00.000Z"
        onChange={onChange}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    const time = await screen.findByLabelText("Time")
    // jsdom's time input has no native segment UI; a whole-value change is the
    // event the control emits in a real browser.
    fireEvent.change(time, { target: { value: "14:45" } })

    expect(onChange).toHaveBeenLastCalledWith("2026-01-15T14:45:00.000Z")
  })

  it("accepts a typed date and time in the Locale and emits the UTC instant", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DatePicker onChange={onChange} aria-label="Due date" />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    const typed = await screen.findByLabelText("Date and time")
    await user.type(typed, "01/20/2026 2:30 PM")
    await user.keyboard("{Enter}")

    expect(onChange).toHaveBeenCalledWith("2026-01-20T14:30:00.000Z")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(typed).toHaveValue("01/20/2026 2:30 PM")
  })

  it("shows the localized typed-entry hint", async () => {
    const user = userEvent.setup()

    render(<DatePicker aria-label="Due date" />)

    await user.click(screen.getByRole("button", { name: "Due date" }))

    expect(
      await screen.findByText("Format: 01/01/2000 12:00 AM")
    ).toBeInTheDocument()
  })

  it("accepts typed entry in Vietnamese", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        locale="vi"
        labels={{
          clear: "Xóa",
          done: "Xong",
          time: "Thời gian",
          typedEntryLabel: "Ngày và giờ",
          typedEntryHint: "Định dạng: {format}",
          typedEntryError: "Vui lòng nhập ngày và giờ hợp lệ.",
        }}
        onChange={onChange}
        aria-label="Hạn chót"
      />
    )

    await user.click(screen.getByRole("button", { name: "Hạn chót" }))
    const typed = await screen.findByLabelText("Ngày và giờ")
    expect(await screen.findByText("Định dạng: 01/01/2000 00:00")).toBeInTheDocument()
    await user.type(typed, "20/01/2026 14:30")
    await user.keyboard("{Enter}")

    expect(onChange).toHaveBeenCalledWith("2026-01-20T14:30:00.000Z")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("rejects typed values outside min/max without emitting", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        min="2026-01-10T00:00:00.000Z"
        max="2026-01-20T00:00:00.000Z"
        onChange={onChange}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    const typed = await screen.findByLabelText("Date and time")
    await user.type(typed, "01/25/2026 12:00 PM")
    await user.keyboard("{Enter}")

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid date and time."
    )
    expect(typed).toHaveAttribute("aria-invalid", "true")
  })

  it("shows an inline error for invalid typed input without emitting", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DatePicker onChange={onChange} aria-label="Due date" />)

    await user.click(screen.getByRole("button", { name: "Due date" }))
    const typed = await screen.findByLabelText("Date and time")
    await user.type(typed, "tomorrow at noon")
    await user.keyboard("{Enter}")

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid date and time."
    )
    expect(typed).toHaveAttribute("aria-invalid", "true")
  })

  it("closes on Done, returns focus to the trigger, and reports blur", async () => {
    const user = userEvent.setup()
    const onBlur = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={vi.fn()}
        onBlur={onBlur}
        aria-label="Due date"
      />
    )

    const trigger = screen.getByRole("button", { name: "Due date" })
    await user.click(trigger)
    await user.click(await screen.findByRole("button", { name: "Done" }))

    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it("clears the value and closes the picker", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={onChange}
        labels={{ clear: "Clear" }}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(await screen.findByRole("button", { name: "Clear" }))

    expect(onChange).toHaveBeenCalledWith("")
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Due date" })).toHaveFocus()
  })

  it("supports keyboard opening, navigation, and selection", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={onChange}
        aria-label="Due date"
      />
    )

    const trigger = screen.getByRole("button", { name: "Due date" })
    trigger.focus()
    await user.keyboard("{Enter}")
    await user.keyboard("{ArrowRight}")
    await user.keyboard("{Enter}")

    expect(onChange).toHaveBeenCalledWith("2026-01-16T00:00:00.000Z")

    await user.keyboard("{Escape}")
    expect(trigger).toHaveFocus()
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={vi.fn()}
        aria-label="Due date"
      />
    )

    const trigger = screen.getByRole("button", { name: "Due date" })
    await user.click(trigger)
    await screen.findByLabelText("Time")
    await user.keyboard("{Escape}")

    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("closes on an outside click and returns focus to the trigger", async () => {
    const user = userEvent.setup()

    render(
      <div>
        <DatePicker
          value="2026-01-15T00:00:00.000Z"
          onChange={vi.fn()}
          aria-label="Due date"
        />
        <button type="button">Outside</button>
      </div>
    )

    const trigger = screen.getByRole("button", { name: "Due date" })
    await user.click(trigger)
    await screen.findByLabelText("Time")
    await user.click(screen.getByRole("button", { name: "Outside" }))

    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("reports blur when focus leaves the closed trigger", async () => {
    const user = userEvent.setup()
    const onBlur = vi.fn()

    render(
      <div>
        <DatePicker onBlur={onBlur} aria-label="Due date" />
        <button type="button">Next field</button>
      </div>
    )

    screen.getByRole("button", { name: "Due date" }).focus()
    await user.tab()

    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it("does not open when disabled", async () => {
    const user = userEvent.setup()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        disabled
        aria-label="Due date"
      />
    )

    const trigger = screen.getByRole("button", { name: "Due date" })
    expect(trigger).toBeDisabled()
    await user.click(trigger)

    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
  })

  it("disables dates outside the inclusive min/max range", async () => {
    const user = userEvent.setup()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        min="2026-01-10T00:00:00.000Z"
        max="2026-01-20T00:00:00.000Z"
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))

    expect(
      await screen.findByRole("button", { name: /January 9/ })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: /January 10/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /January 20/ })).toBeEnabled()
    expect(screen.getByRole("button", { name: /January 21/ })).toBeDisabled()
  })

  it("treats min/max instants as inclusive local calendar days", async () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    const user = userEvent.setup()

    try {
      render(
        <DatePicker
          value="2026-01-15T00:00:00.000Z"
          // Both bounds carry a time in UTC and fall on a different local day
          // at the lower edge: 20:00Z is 03:00 on January 11 locally.
          min="2026-01-10T20:00:00.000Z"
          max="2026-01-20T16:00:00.000Z"
          aria-label="Due date"
        />
      )

      await user.click(screen.getByRole("button", { name: "Due date" }))

      expect(
        await screen.findByRole("button", { name: /January 10/ })
      ).toBeDisabled()
      expect(screen.getByRole("button", { name: /January 11/ })).toBeEnabled()
      expect(screen.getByRole("button", { name: /January 20/ })).toBeEnabled()
      expect(screen.getByRole("button", { name: /January 21/ })).toBeDisabled()
    } finally {
      process.env.TZ = "UTC"
    }
  })

  it("renders a hidden named input carrying the instant", () => {
    const { container } = render(
      <DatePicker
        name="dueDate"
        value="2026-01-15T00:00:00.000Z"
        aria-label="Due date"
      />
    )

    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"]'
    )
    expect(hidden).toHaveAttribute("name", "dueDate")
    expect(hidden).toHaveValue("2026-01-15T00:00:00.000Z")
  })

  it("does nothing when the selected day is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={onChange}
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(
      await screen.findByRole("button", { name: /January 15/ })
    )

    expect(onChange).not.toHaveBeenCalled()
  })

  it("uses month and year dropdown captions bounded by min/max", async () => {
    const user = userEvent.setup()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        min="2024-01-01T00:00:00.000Z"
        max="2026-12-31T00:00:00.000Z"
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))

    expect(await screen.findByLabelText("Choose the Month")).toBeInTheDocument()
    const year = screen.getByLabelText("Choose the Year")
    expect(
      within(year)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["2024", "2025", "2026"])
  })

  it("clamps the default month into the min/max bounds", async () => {
    const user = userEvent.setup()

    render(
      <DatePicker
        min="2026-02-01T00:00:00.000Z"
        max="2026-04-30T00:00:00.000Z"
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))

    // Today is outside the allowed range, so the calendar opens on the
    // nearest allowed month instead of an empty/out-of-range month.
    expect(await screen.findByLabelText("Choose the Month")).toHaveValue("3")
  })

  it("uses the sheet on a wide viewport with a coarse pointer", async () => {
    const coarse = window as unknown as { __coarsePointer?: boolean }
    coarse.__coarsePointer = true
    const user = userEvent.setup()

    try {
      render(
        <DatePicker value="2026-01-15T00:00:00.000Z" aria-label="Due date" />
      )

      await user.click(screen.getByRole("button", { name: "Due date" }))

      expect(await screen.findByRole("dialog")).toBeInTheDocument()
    } finally {
      coarse.__coarsePointer = false
    }
  })

  it("opens in a sheet with one calendar month on narrow viewports", async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 375,
    })
    const user = userEvent.setup()

    try {
      render(
        <DatePicker value="2026-01-15T00:00:00.000Z" aria-label="Due date" />
      )

      await user.click(screen.getByRole("button", { name: "Due date" }))

      expect(await screen.findByRole("dialog")).toBeInTheDocument()
      expect(
        await screen.findByRole("button", { name: /January 15/ })
      ).toBeInTheDocument()
      expect(screen.getAllByRole("grid")).toHaveLength(1)
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalWidth,
      })
    }
  })

  it("exposes validation state on the trigger", () => {
    render(
      <DatePicker
        aria-label="Due date"
        aria-invalid
        aria-describedby="due-date-error"
      />
    )

    const trigger = screen.getByRole("button", { name: "Due date" })
    expect(trigger).toHaveAttribute("aria-invalid", "true")
    expect(trigger).toHaveAttribute("aria-describedby", "due-date-error")
  })
})
