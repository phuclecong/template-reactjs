import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import { Button } from "./button"
import { Toaster } from "./sonner"
import { toast } from "../lib/sonner"

function ToastDemo() {
  return (
    <>
      <Toaster position="bottom-right" richColors />
      <div className="flex gap-2">
        <Button
          onClick={() =>
            toast.success("Saved", { description: "Your changes are live." })
          }
        >
          Success toast
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            toast.error("Failed", {
              description: "Could not save your changes.",
            })
          }
        >
          Error toast
        </Button>
      </div>
    </>
  )
}

const meta = {
  title: "Primitives/Toast",
  component: Toaster,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <ToastDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: "Success toast" }))

    await expect(
      await within(document.body).findByText("Saved")
    ).toBeInTheDocument()

    const toaster = document.querySelector("[data-sonner-toaster]")
    await expect(toaster).toHaveAttribute("data-y-position", "bottom")
    await expect(toaster).toHaveAttribute("data-x-position", "right")
  },
}
