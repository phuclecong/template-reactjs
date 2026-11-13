import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { Button } from "./button"
import { Dialog } from "./dialog"

function DialogDemo({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
      >
        <p className="text-sm text-muted-foreground">
          Dialog body content goes here. Focus is trapped while open; Escape and
          the backdrop close it.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>Confirm</Button>
        </div>
      </Dialog>
    </>
  )
}

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { open: false, onClose: () => {}, title: "Dialog", children: null },
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
