import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import { Textarea } from "./textarea"

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { "aria-label": "Description", placeholder: "Add a description…" },
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByRole("textbox", { name: "Description" })

    await userEvent.type(textarea, "Write release notes")
    await expect(textarea).toHaveValue("Write release notes")
  },
}

export const WithValue: Story = {
  args: { defaultValue: "A short task description." },
}

export const Disabled: Story = {
  args: { disabled: true, "aria-label": "Description (disabled)" },
}

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "",
    "aria-label": "Description (invalid)",
  },
}
