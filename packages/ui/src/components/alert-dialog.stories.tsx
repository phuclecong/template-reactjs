import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { AlertDialog } from "./alert-dialog"
import { Button } from "./button"

function AlertDialogDemo({
  description,
  confirmLabel = "Delete",
}: {
  description?: string
  confirmLabel?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Open alert dialog
      </Button>
      <AlertDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete task"
        description={description}
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => setOpen(false)}>
            {confirmLabel}
          </Button>
        </div>
      </AlertDialog>
    </>
  )
}

const meta = {
  title: "Primitives/AlertDialog",
  component: AlertDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    open: false,
    onClose: () => {},
    title: "Delete task",
    children: null,
  },
} satisfies Meta<typeof AlertDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <AlertDialogDemo description="This action cannot be undone." />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", {
      name: "Open alert dialog",
    })

    await userEvent.click(trigger)

    const dialog = await within(document.body).findByRole("alertdialog")
    await expect(dialog).toHaveTextContent("Delete task")
    await expect(
      within(dialog).getByText("This action cannot be undone.")
    ).toBeVisible()

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" })
    )
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("alertdialog")
      ).not.toBeInTheDocument()
    )

    // Confirming is the other explicit close path.
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

export const WithDescription: Story = {
  render: () => (
    <AlertDialogDemo description="The task and its history will be removed." />
  ),
}

export const WithoutDescription: Story = {
  render: () => <AlertDialogDemo />,
}
