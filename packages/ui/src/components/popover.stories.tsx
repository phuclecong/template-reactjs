import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover"

const meta = {
  title: "Primitives/Popover",
  component: Popover,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        Open popover
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Popover title</PopoverTitle>
          <PopoverDescription>
            Base UI handles positioning, focus, Escape, and outside-click
            dismissal. The content uses the design system tokens.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
}

export const Open: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline" />}>
        Open popover
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Popover title</PopoverTitle>
          <PopoverDescription>
            This story starts open so the popup content is visible in
            screenshots and docs.
          </PopoverDescription>
        </PopoverHeader>
        <Button size="sm">Action</Button>
      </PopoverContent>
    </Popover>
  ),
}

export const WithCalendar: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline" />}>
        Pick a date
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={new Date(2026, 0, 15)}
          defaultMonth={new Date(2026, 0, 1)}
        />
      </PopoverContent>
    </Popover>
  ),
}

export const DarkMode: Story = {
  render: () => (
    <div className="dark bg-background p-4 text-foreground">
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" />}>
          Open popover
        </PopoverTrigger>
        {/* The popup is portaled outside the dark wrapper, so it carries the
            `dark` class itself to resolve the dark token values. */}
        <PopoverContent className="dark">
          <PopoverHeader>
            <PopoverTitle>Dark mode popover</PopoverTitle>
            <PopoverDescription>
              Rendered with the design system dark tokens.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </div>
  ),
}
