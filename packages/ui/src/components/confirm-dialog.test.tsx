import { useState } from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "./button"
import { ConfirmDialog } from "./confirm-dialog"

function Harness({
  onClose,
  onConfirm,
  loading = false,
}: {
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open confirm</Button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        title="Delete task"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={loading}
        onConfirm={onConfirm}
      />
    </>
  )
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open confirm" }))
  return screen.findByRole("alertdialog", { name: "Delete task" })
}

describe("ConfirmDialog", () => {
  it("renders an alertdialog with the title, description, and both actions", async () => {
    const user = userEvent.setup()
    render(<Harness onClose={vi.fn()} onConfirm={vi.fn()} />)

    const dialog = await openDialog(user)

    expect(dialog).toBeVisible()
    expect(
      within(dialog).getByText("This action cannot be undone.")
    ).toBeVisible()
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toBeVisible()
    expect(
      within(dialog).getByRole("button", { name: "Delete" })
    ).toBeVisible()
    // A forced decision has no header close button.
    expect(
      within(dialog).queryByRole("button", { name: "Close" })
    ).not.toBeInTheDocument()
  })

  it("calls onClose only when Cancel is chosen", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<Harness onClose={onClose} onConfirm={onConfirm} />)

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  it("calls onConfirm only when Confirm is chosen, leaving closing to the caller", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<Harness onClose={onClose} onConfirm={onConfirm} />)

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    // The mutation owns closing, so a pending confirmation stays open.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("ignores Escape", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} onConfirm={vi.fn()} />)

    await openDialog(user)
    await user.keyboard("{Escape}")

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("ignores outside clicks", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} onConfirm={vi.fn()} />)

    await openDialog(user)
    await user.click(document.body)

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("disables Confirm while loading", async () => {
    const user = userEvent.setup()
    render(<Harness onClose={vi.fn()} onConfirm={vi.fn()} loading />)

    const dialog = await openDialog(user)

    expect(
      within(dialog).getByRole("button", { name: "Delete" })
    ).toBeDisabled()
  })

  it("returns focus to the opener after an explicit cancel", async () => {
    const user = userEvent.setup()
    render(<Harness onClose={vi.fn()} onConfirm={vi.fn()} />)

    const trigger = screen.getByRole("button", { name: "Open confirm" })
    trigger.focus()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
