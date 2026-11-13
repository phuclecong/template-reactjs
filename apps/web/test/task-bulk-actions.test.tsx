// @vitest-environment jsdom
import type { ComponentProps } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { TaskBulkActions } from "@/features/tasks/components/task-bulk-actions"

const originalTimeZone = process.env.TZ

const USERS = [
  { id: "usr_admin", name: "Ada Admin" },
  { id: "usr_member", name: "Mia Member" },
]

type BulkProps = Partial<ComponentProps<typeof TaskBulkActions>>

beforeEach(async () => {
  process.env.TZ = "UTC"
  await i18n.changeLanguage("en")
})

afterEach(() => {
  process.env.TZ = originalTimeZone
})

function bulkUi(
  applyBulk: ReturnType<typeof vi.fn>,
  props: BulkProps = {}
) {
  return (
    <I18nextProvider i18n={i18n}>
      <TaskBulkActions
        hasSelection
        selectedCount={1}
        users={USERS}
        applyBulk={applyBulk}
        onCreate={vi.fn()}
        isApplying={false}
        {...props}
      />
    </I18nextProvider>
  )
}

function renderBulk(
  applyBulk: ReturnType<typeof vi.fn>,
  props: BulkProps = {}
) {
  return render(bulkUi(applyBulk, props))
}

async function chooseAction(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(screen.getByRole("combobox", { name: "Bulk actions" }))
  await user.click(await screen.findByRole("option", { name }))
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
  it("applies the selected date immediately and keeps the picker open", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await user.click(screen.getByRole("button", { name: "Set due date" }))
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))

    expect(applyBulk).toHaveBeenCalledWith({
      dueDate: startOfLocalTodayAt(0, 0),
    })
    // The popover stays open so the time can be adjusted.
    expect(screen.getByLabelText("Time")).toBeInTheDocument()
  })

  it("applies each time adjustment immediately", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await user.click(screen.getByRole("button", { name: "Set due date" }))
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))

    const time = await screen.findByLabelText("Time")
    fireEvent.change(time, { target: { value: "14:30" } })

    expect(applyBulk).toHaveBeenLastCalledWith({
      dueDate: startOfLocalTodayAt(14, 30),
    })
    expect(applyBulk).toHaveBeenCalledTimes(2)
  })

  it("applies a typed datetime and resets the control when it closes", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    const trigger = screen.getByRole("button", { name: "Set due date" })
    await user.click(trigger)
    const typed = await screen.findByLabelText("Date and time")
    await user.clear(typed)
    await user.type(typed, "01/20/2026 2:30 PM")
    await user.keyboard("{Enter}")

    expect(applyBulk).toHaveBeenCalledWith({
      dueDate: "2026-01-20T14:30:00.000Z",
    })

    await user.click(screen.getByRole("button", { name: "Done" }))

    expect(trigger).toHaveTextContent("Set due date")
  })

  it("resets the local control when the popover is dismissed", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    const trigger = screen.getByRole("button", { name: "Set due date" })
    await user.click(trigger)
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))
    expect(applyBulk).toHaveBeenCalledTimes(1)

    await user.keyboard("{Escape}")

    expect(trigger).toHaveTextContent("Set due date")
    await user.click(trigger)
    expect(await screen.findByLabelText("Time")).toBeDisabled()
  })
})

describe("TaskBulkActions actions combobox", () => {
  it("disables the Bulk actions trigger without a selection", () => {
    renderBulk(vi.fn(), { hasSelection: false })

    expect(
      screen.getByRole("combobox", { name: "Bulk actions" })
    ).toBeDisabled()
  })

  it("lists every action under its group heading", async () => {
    const user = userEvent.setup()
    renderBulk(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Bulk actions" }))

    const status = await screen.findByRole("group", { name: "Status" })
    expect(
      within(status)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["todo", "in-progress", "done", "blocked"])

    const priority = screen.getByRole("group", { name: "Priority" })
    expect(
      within(priority)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["low", "medium", "high", "None"])

    const assignee = screen.getByRole("group", { name: "Assignee" })
    expect(
      within(assignee)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Ada Admin", "Mia Member", "Unassigned"])

    const dueDate = screen.getByRole("group", { name: "Due date" })
    expect(
      within(dueDate).getByRole("option", { name: "Clear due date" })
    ).toBeInTheDocument()
  })

  it("searches group labels as well as option labels", async () => {
    const user = userEvent.setup()
    renderBulk(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Bulk actions" }))
    const search = await screen.findByRole("combobox", {
      name: "Search actions",
    })

    await user.type(search, "assign")

    expect(
      await screen.findByRole("group", { name: "Assignee" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Status" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Priority" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Due date" })).toBeNull()

    await user.clear(search)
    await user.type(search, "status")

    expect(await screen.findByRole("group", { name: "Status" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Assignee" })).toBeNull()

    await user.clear(search)
    await user.type(search, "priority")

    expect(
      await screen.findByRole("group", { name: "Priority" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Status" })).toBeNull()

    await user.clear(search)
    await user.type(search, "blocked")

    expect(
      await screen.findByRole("option", { name: "blocked" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "todo" })).toBeNull()
  })

  it("confirms the action and selected Task count before applying, and cancelling changes nothing", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk, { selectedCount: 3 })

    await chooseAction(user, "done")

    const dialog = await screen.findByRole("alertdialog", {
      name: 'Apply "done" to 3 tasks?',
    })
    expect(dialog).toBeVisible()
    // Selecting an action closes the action popup before the confirmation.
    expect(screen.queryByRole("listbox")).toBeNull()

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(applyBulk).not.toHaveBeenCalled()
  })

  it("applies the chosen status patch after confirmation", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "done")
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Apply",
      })
    )

    expect(applyBulk).toHaveBeenCalledWith({ status: "done" })
  })

  it("keeps the confirmation open and disables Apply while the update is in flight", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    const { rerender } = renderBulk(applyBulk)

    await chooseAction(user, "done")
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(applyBulk).toHaveBeenCalledTimes(1)

    rerender(bulkUi(applyBulk, { isApplying: true }))

    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()

    rerender(bulkUi(applyBulk, { isApplying: false }))

    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("confirms Clear due date before applying it", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "Clear due date")

    const dialog = await screen.findByRole("alertdialog", {
      name: 'Apply "Clear due date" to 1 tasks?',
    })
    await user.click(within(dialog).getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith({ dueDate: null })
  })

  it("maps the None priority action to a null priority", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "None")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith({ priority: null })
  })

  it("applies a named assignee", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "Ada Admin")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith({ assigneeId: "usr_admin" })
  })

  it("maps Unassigned to a null assignee", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "Unassigned")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith({ assigneeId: null })
  })
})
