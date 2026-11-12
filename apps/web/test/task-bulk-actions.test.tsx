// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { TaskBulkActions } from "@/features/tasks/components/task-bulk-actions"

const originalTimeZone = process.env.TZ

beforeEach(async () => {
  process.env.TZ = "UTC"
  await i18n.changeLanguage("en")
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

function renderBulk(applyBulk: ReturnType<typeof vi.fn>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TaskBulkActions
        hasSelection
        selectedCount={1}
        users={[]}
        applyBulk={applyBulk}
        onCreate={vi.fn()}
      />
    </I18nextProvider>
  )
}

function startOfLocalTodayAt(hours: number, minutes: number): string {
  const now = new Date()
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  ).toISOString()
}

describe("TaskBulkActions Due date", () => {
  it("holds the datetime until Done, applies the instant, and resets", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    const trigger = screen.getByRole("button", { name: "Set due date" })
    await user.click(trigger)
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))

    const time = await screen.findByLabelText("Time")
    fireEvent.change(time, { target: { value: "14:30" } })

    // Choosing a date and time does not write until the user is done.
    expect(applyBulk).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Done" }))

    expect(applyBulk).toHaveBeenCalledWith({
      dueDate: startOfLocalTodayAt(14, 30),
    })
    expect(applyBulk).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveTextContent("Set due date")
  })

  it("applies a typed datetime and resets the control", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    const trigger = screen.getByRole("button", { name: "Set due date" })
    await user.click(trigger)
    const typed = await screen.findByLabelText("Date and time")
    await user.clear(typed)
    await user.type(typed, "2026-01-20 14:30")

    expect(applyBulk).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Done" }))

    expect(applyBulk).toHaveBeenCalledWith({
      dueDate: "2026-01-20T14:30:00.000Z",
    })
    expect(trigger).toHaveTextContent("Set due date")
  })

  it("discards a draft that is dismissed without Done", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    const trigger = screen.getByRole("button", { name: "Set due date" })
    await user.click(trigger)
    const typed = await screen.findByLabelText("Date and time")
    await user.clear(typed)
    await user.type(typed, "2026-01-20 14:30")
    await user.keyboard("{Escape}")

    expect(applyBulk).not.toHaveBeenCalled()
    expect(trigger).toHaveTextContent("Set due date")
  })

  it("keeps the separate clear Due date action", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await user.click(screen.getByRole("button", { name: "Clear due date" }))

    expect(applyBulk).toHaveBeenCalledWith({ dueDate: null })
  })
})
