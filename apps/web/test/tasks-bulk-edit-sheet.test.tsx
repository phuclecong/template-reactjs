// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { TasksBulkEditSheet } from "@/features/tasks/components/tasks-bulk-edit-sheet"

const USERS = [
  { id: "usr_admin", name: "Ada Admin" },
  { id: "usr_member", name: "Mia Member" },
]

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

afterEach(async () => {
  await i18n.changeLanguage("en")
})

async function renderSheet(
  onApply: ReturnType<typeof vi.fn>,
  selectedCount = 2
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TasksBulkEditSheet
          open
          onOpenChange={vi.fn()}
          selectedCount={selectedCount}
          users={USERS}
          onApply={onApply}
          isApplying={false}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
  // The sheet mounts one animation frame after `open` so its slide-in
  // transition runs; wait for the content before querying.
  await screen.findByRole("button", { name: "Apply changes" })
  return onApply
}

function applyButton() {
  return screen.getByRole("button", { name: "Apply changes" })
}

describe("TasksBulkEditSheet", () => {
  it("starts with every field unchanged and Apply disabled", async () => {
    await renderSheet(vi.fn())

    expect(
      screen.getByRole("heading", { name: "Edit 2 tasks" })
    ).toBeVisible()
    expect(applyButton()).toBeDisabled()
  })

  it("applies a chosen status", async () => {
    const user = userEvent.setup()
    const onApply = await renderSheet(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Status" }))
    await user.click(await screen.findByRole("option", { name: "Done" }))
    await user.click(applyButton())

    expect(onApply).toHaveBeenCalledWith({ status: "done" })
  })

  it("maps the None priority to null", async () => {
    const user = userEvent.setup()
    const onApply = await renderSheet(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Priority" }))
    await user.click(await screen.findByRole("option", { name: "None" }))
    await user.click(applyButton())

    expect(onApply).toHaveBeenCalledWith({ priority: null })
  })

  it("maps Unassigned to a null assignee and a named user to an id", async () => {
    const user = userEvent.setup()
    const onApply = await renderSheet(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Assignee" }))
    await user.click(await screen.findByRole("option", { name: "Unassigned" }))
    await user.click(applyButton())

    expect(onApply).toHaveBeenCalledWith({ assigneeId: null })
  })

  it("sends a named assignee id", async () => {
    const user = userEvent.setup()
    const onApply = await renderSheet(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Assignee" }))
    await user.click(await screen.findByRole("option", { name: "Ada Admin" }))
    await user.click(applyButton())

    expect(onApply).toHaveBeenCalledWith({ assigneeId: "usr_admin" })
  })

  it("applies several dirty fields in one patch", async () => {
    const user = userEvent.setup()
    const onApply = await renderSheet(vi.fn())

    await user.click(screen.getByRole("combobox", { name: "Status" }))
    await user.click(await screen.findByRole("option", { name: "Done" }))
    await user.click(screen.getByRole("combobox", { name: "Priority" }))
    await user.click(await screen.findByRole("option", { name: "High" }))
    await user.click(applyButton())

    expect(onApply).toHaveBeenCalledWith({ status: "done", priority: "high" })
  })

  it("clears the due date through an explicit intent flag", async () => {
    const user = userEvent.setup()
    const onApply = await renderSheet(vi.fn())

    await user.click(screen.getByRole("button", { name: "Clear due date" }))

    expect(
      screen.getByText("The due date will be cleared.", { exact: true })
    ).toBeVisible()

    await user.click(applyButton())

    expect(onApply).toHaveBeenCalledWith({ dueDate: null })
  })
})
