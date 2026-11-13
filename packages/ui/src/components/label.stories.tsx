import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "Primitives/Label",
  component: Label,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: "Email address" },
}

export const AssociatedWithInput: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="label-story-email">Email address</Label>
      <Input id="label-story-email" type="email" placeholder="you@example.com" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Email address" })

    await userEvent.click(canvas.getByText("Email address"))
    await expect(input).toHaveFocus()

    await userEvent.type(input, "paul@example.com")
    await expect(input).toHaveValue("paul@example.com")
  },
}
