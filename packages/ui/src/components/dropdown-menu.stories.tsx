import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"

const meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Open menu
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Open menu" })

    await userEvent.click(trigger)

    const menu = await within(document.body).findByRole("menu")
    await expect(within(menu).getByText("Profile")).toBeVisible()

    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(within(document.body).queryByRole("menu")).not.toBeInTheDocument()
    )

    await userEvent.click(trigger)
    const reopened = await within(document.body).findByRole("menu")
    await userEvent.click(
      within(reopened).getByRole("menuitem", { name: "Settings" })
    )
    await waitFor(() =>
      expect(within(document.body).queryByRole("menu")).not.toBeInTheDocument()
    )
  },
}
