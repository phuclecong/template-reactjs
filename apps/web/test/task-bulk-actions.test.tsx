// @vitest-environment jsdom
import type { ComponentProps } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
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

function bulkUi(applyBulk: ReturnType<typeof vi.fn>, props: BulkProps = {}) {
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

async function openDueDatePicker(user: ReturnType<typeof userEvent.setup>) {
  // The DatePicker lives inside the bulk-actions popup.
  await user.click(screen.getByRole("combobox", { name: "Bulk actions" }))
  await user.click(await screen.findByRole("button", { name: "Set due date" }))
}

describe("TaskBulkActions Due date", () => {
  it("drafts the selected date and applies it only after confirmation", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await openDueDatePicker(user)
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))

    // Picking a date keeps the picker open and does not apply yet.
    expect(applyBulk).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Time")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "14:30" },
    })
    await user.click(screen.getByRole("button", { name: "Done" }))

    const dialog = await screen.findByRole("alertdialog", {
      name: 'Apply "Set due date" to 1 tasks?',
    })
    await user.click(within(dialog).getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith(
      { dueDate: startOfLocalTodayAt(14, 30) },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })

  it("applies a typed datetime through the confirmation dialog", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await openDueDatePicker(user)
    const typed = await screen.findByLabelText("Date and time")
    await user.clear(typed)
    await user.type(typed, "01/20/2026 2:30 PM")
    await user.click(screen.getByRole("button", { name: "Done" }))

    const dialog = await screen.findByRole("alertdialog", {
      name: 'Apply "Set due date" to 1 tasks?',
    })
    await user.click(within(dialog).getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith(
      { dueDate: "2026-01-20T14:30:00.000Z" },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })

  it("discards the draft when the picker closes without Done", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await openDueDatePicker(user)
    await user.click(await screen.findByRole("button", { name: /^Today,/ }))
    expect(applyBulk).not.toHaveBeenCalled()

    await user.keyboard("{Escape}")

    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
    expect(applyBulk).not.toHaveBeenCalled()

    // Reopening the picker starts from an empty draft.
    if (!screen.queryByRole("button", { name: "Set due date" })) {
      await user.click(screen.getByRole("combobox", { name: "Bulk actions" }))
    }
    await user.click(
      await screen.findByRole("button", { name: "Set due date" })
    )
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

    expect(
      await screen.findByRole("group", { name: "Status" })
    ).toBeInTheDocument()
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
    // The confirmation explains the scope of the update.
    expect(
      within(dialog).getByText("This will update 3 selected tasks.")
    ).toBeVisible()
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

    expect(applyBulk).toHaveBeenCalledWith(
      { status: "done" },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })

  it("keeps the confirmation open and disables Apply while the update is in flight", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    const { rerender } = renderBulk(applyBulk)

    await chooseAction(user, "done")
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(applyBulk).toHaveBeenCalledTimes(1)

    // Settlement is delivered through the mutation callback, not an effect.
    const onSettled = applyBulk.mock.calls[0]?.[1]?.onSettled as
      | (() => void)
      | undefined
    expect(onSettled).toBeTypeOf("function")

    rerender(bulkUi(applyBulk, { isApplying: true }))

    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()

    act(() => onSettled?.())
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

    expect(applyBulk).toHaveBeenCalledWith(
      { dueDate: null },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })

  it("maps the None priority action to a null priority", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "None")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith(
      { priority: null },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })

  it("applies a named assignee", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "Ada Admin")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith(
      { assigneeId: "usr_admin" },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })

  it("maps Unassigned to a null assignee", async () => {
    const user = userEvent.setup()
    const applyBulk = vi.fn()
    renderBulk(applyBulk)

    await chooseAction(user, "Unassigned")
    await user.click(screen.getByRole("button", { name: "Apply" }))

    expect(applyBulk).toHaveBeenCalledWith(
      { assigneeId: null },
      expect.objectContaining({ onSettled: expect.any(Function) })
    )
  })
})
