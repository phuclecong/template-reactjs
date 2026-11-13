import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { Button } from "./button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog"

function DialogDemo({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Dialog body content goes here. Focus is trapped while open; Escape, the
          backdrop, and the close button all dismiss it.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={() => setOpen(false)}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <DialogDemo title="Edit task" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Open dialog" })

    await userEvent.click(trigger)

    const dialog = await within(document.body).findByRole("dialog")
    await expect(dialog).toHaveTextContent("Edit task")
    await expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toBeVisible()

    // Escape is a safe dismissal path for a form/view dialog.
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("dialog")
      ).not.toBeInTheDocument()
    )

    // The header close button is the other dismissal path.
    await userEvent.click(trigger)
    const reopened = await within(document.body).findByRole("dialog")
    await userEvent.click(
      within(reopened).getByRole("button", { name: "Close" })
    )
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("dialog")
      ).not.toBeInTheDocument()
    )
  },
}

export const WithDescription: Story = {
  render: () => (
    <DialogDemo
      title="Delete task"
      description="This action cannot be undone."
    />
  ),
}
