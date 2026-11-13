import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

const meta = {
  title: "Primitives/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-64">{Story()}</div>],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Select
      defaultValue="todo"
      items={{ todo: "Todo", "in-progress": "In progress", done: "Done" }}
    >
      <SelectTrigger aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">Todo</SelectItem>
        <SelectItem value="in-progress">In progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("combobox", { name: "Status" })

    await expect(trigger).toHaveTextContent("Todo")

    await userEvent.click(trigger)
    const listbox = await within(document.body).findByRole("listbox")
    await userEvent.click(within(listbox).getByRole("option", { name: "Done" }))

    await expect(trigger).toHaveTextContent("Done")
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("listbox")
      ).not.toBeInTheDocument()
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <Select
      defaultValue="todo"
      disabled
      items={{ todo: "Todo", "in-progress": "In progress", done: "Done" }}
    >
      <SelectTrigger aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">Todo</SelectItem>
        <SelectItem value="in-progress">In progress</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  ),
}
