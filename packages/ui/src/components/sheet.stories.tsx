import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { Button } from "./button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

const meta = {
  title: "Primitives/Sheet",
  component: Sheet,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        Open sheet
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Sheet title</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Open sheet" })

    await userEvent.click(trigger)

    const sheet = await within(document.body).findByRole("dialog")
    await expect(sheet).toHaveTextContent("Sheet title")

    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("dialog")
      ).not.toBeInTheDocument()
    )
  },
}
