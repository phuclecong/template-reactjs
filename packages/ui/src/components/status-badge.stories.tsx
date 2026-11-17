import type { Meta, StoryObj } from "@storybook/react"

import { StatusBadge } from "./status-badge"

const meta = {
  title: "Primitives/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "Active", status: "active" },
  argTypes: {
    status: {
      control: "select",
      options: ["active", "inactive"],
    },
  },
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}

export const Inactive: Story = {
  args: { children: "Inactive", status: "inactive" },
}
