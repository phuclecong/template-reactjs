import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import { Input } from "./input"
import { Textarea } from "./textarea"

const meta = {
  title: "Primitives/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { placeholder: "you@example.com", type: "email" },
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText("you@example.com")

    await userEvent.click(input)
    await expect(input).toHaveFocus()

    await userEvent.type(input, "paul@example.com")
    await expect(input).toHaveValue("paul@example.com")
  },
}

export const WithValue: Story = {
  args: { defaultValue: "paul@example.com" },
}

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Disabled input" },
}

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "not-an-email" },
}

export const TextareaExample: StoryObj<typeof Textarea> = {
  render: () => <Textarea rows={3} placeholder="Add a description…" />,
}
