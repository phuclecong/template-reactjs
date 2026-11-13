import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import { Checkbox } from "./checkbox"

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { "aria-label": "Accept terms" },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkbox = canvas.getByRole("checkbox", {
      name: "Accept terms",
    })

    await expect(checkbox).not.toBeChecked()

    await userEvent.click(checkbox)
    await expect(checkbox).toBeChecked()

    await userEvent.click(checkbox)
    await expect(checkbox).not.toBeChecked()
  },
}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const Indeterminate: Story = {
  args: { indeterminate: true },
}

export const Disabled: Story = {
  args: { disabled: true, "aria-label": "Accept terms (disabled)" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkbox = canvas.getByRole("checkbox", {
      name: "Accept terms (disabled)",
    })

    await expect(checkbox).toHaveAttribute("data-disabled")

    await userEvent.click(checkbox)
    await expect(checkbox).not.toBeChecked()
  },
}
