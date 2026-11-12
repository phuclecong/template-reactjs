import { render, screen } from "@testing-library/react"
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

  it("shows the locale-aware date in the trigger", () => {
    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        locale="vi"
        aria-label="Due date"
      />
    )

    expect(screen.getByRole("button", { name: "Due date" })).toHaveTextContent(
      "15 thg 1, 2026"
    )
  })

  it("clears the value and closes the picker", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DatePicker
        value="2026-01-15T00:00:00.000Z"
        onChange={onChange}
        clearLabel="Clear"
        aria-label="Due date"
      />
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.click(await screen.findByRole("button", { name: "Clear" }))

    expect(onChange).toHaveBeenCalledWith("")
    expect(
      screen.queryByRole("button", { name: /January 15/ })
    ).not.toBeInTheDocument()
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
    await screen.findByRole("button", { name: /January 15/ })
    await user.keyboard("{Escape}")

    expect(
      screen.queryByRole("button", { name: /January 15/ })
    ).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
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

    expect(
      screen.queryByRole("button", { name: /January 15/ })
    ).not.toBeInTheDocument()
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

  it("forwards blur to the caller", async () => {
    const user = userEvent.setup()
    const onBlur = vi.fn()

    render(
      <div>
        <DatePicker onBlur={onBlur} aria-label="Due date" />
        <button type="button">Next field</button>
      </div>
    )

    await user.click(screen.getByRole("button", { name: "Due date" }))
    await user.tab()

    expect(onBlur).toHaveBeenCalledTimes(1)
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
