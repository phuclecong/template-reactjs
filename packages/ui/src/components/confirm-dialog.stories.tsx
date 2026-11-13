import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { Button } from "./button"
import { ConfirmDialog } from "./confirm-dialog"

function ConfirmDialogDemo({
  tone = "danger",
  loading = false,
}: {
  tone?: "danger" | "default"
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant={tone === "default" ? "default" : "destructive"}
        onClick={() => setOpen(true)}
      >
        Open confirm dialog
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete task"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone={tone}
        loading={loading}
        onConfirm={() => setOpen(false)}
      />
    </>
  )
}

const meta = {
  title: "Primitives/ConfirmDialog",
  component: ConfirmDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    open: false,
    onClose: () => {},
    title: "Delete task",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    onConfirm: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Danger: Story = {
  render: () => <ConfirmDialogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", {
      name: "Open confirm dialog",
    })

    await userEvent.click(trigger)

    const dialog = await within(document.body).findByRole("alertdialog")
    await expect(dialog).toHaveTextContent("Delete task")

    // A forced decision cannot be dismissed with Escape.
    await userEvent.keyboard("{Escape}")
    await expect(
      within(document.body).getByRole("alertdialog")
    ).toBeVisible()

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" })
    )
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("alertdialog")
      ).not.toBeInTheDocument()
    )

    await userEvent.click(trigger)
    const reopened = await within(document.body).findByRole("alertdialog")
    await userEvent.click(
      within(reopened).getByRole("button", { name: "Delete" })
    )
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("alertdialog")
      ).not.toBeInTheDocument()
    )
  },
}

export const Default: Story = {
  render: () => <ConfirmDialogDemo tone="default" />,
}

export const Loading: Story = {
  render: () => <ConfirmDialogDemo loading />,
}
