import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog"
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
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Open alert dialog
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task</AlertDialogTitle>
          {description !== undefined ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => setOpen(false)}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const meta = {
  title: "Primitives/AlertDialog",
  component: AlertDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
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

    // Cancel is the explicit rejection path.
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
