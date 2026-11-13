import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"
import * as React from "react"
import type { DateRange } from "react-day-picker"
import { enUS } from "react-day-picker/locale/en-US"
import { vi } from "react-day-picker/locale/vi"

import { Calendar } from "./calendar"

const january2026 = new Date(2026, 0, 1)

function SingleCalendar() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 0, 15)
  )

  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={january2026}
    />
  )
}

function EmptySingleCalendar() {
  const [selected, setSelected] = React.useState<Date | undefined>(undefined)

  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={setSelected}
      defaultMonth={january2026}
    />
  )
}

function RangeCalendar() {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(2026, 0, 12),
    to: new Date(2026, 0, 18),
  })

  return (
    <Calendar
      mode="range"
      selected={range}
      onSelect={setRange}
      defaultMonth={january2026}
      numberOfMonths={2}
    />
  )
}

const meta = {
  title: "Primitives/Calendar",
  component: Calendar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    captionLayout: {
      control: "select",
      options: ["label", "dropdown", "dropdown-months", "dropdown-years"],
    },
    locale: { control: false },
  },
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <EmptySingleCalendar />,
}

export const WithSelectedDate: Story = {
  render: () => <SingleCalendar />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const day = canvas.getByRole("button", { name: /January 20/ })

    await userEvent.click(day)

    await expect(day).toHaveAttribute("data-selected-single", "true")
    await expect(day.closest("[role='gridcell']")).toHaveAttribute(
      "aria-selected",
      "true"
    )
  },
}

export const Range: Story = {
  render: () => <RangeCalendar />,
}

export const MonthYearDropdown: Story = {
  render: () => (
    <Calendar
      mode="single"
      selected={new Date(2026, 0, 15)}
      defaultMonth={january2026}
      captionLayout="dropdown"
      startMonth={new Date(2024, 0, 1)}
      endMonth={new Date(2028, 11, 31)}
    />
  ),
}

export const DisabledDays: Story = {
  render: () => (
    <Calendar
      mode="single"
      selected={new Date(2026, 0, 15)}
      defaultMonth={january2026}
      disabled={[
        { before: new Date(2026, 0, 5) },
        { after: new Date(2026, 0, 25) },
        { dayOfWeek: [0, 6] },
      ]}
    />
  ),
}

export const VietnameseLocale: Story = {
  render: () => (
    <Calendar
      mode="single"
      selected={new Date(2026, 0, 15)}
      defaultMonth={january2026}
      locale={vi}
      captionLayout="dropdown"
      startMonth={new Date(2024, 0, 1)}
      endMonth={new Date(2028, 11, 31)}
    />
  ),
}

export const EnglishLocale: Story = {
  render: () => (
    <Calendar
      mode="single"
      selected={new Date(2026, 0, 15)}
      defaultMonth={january2026}
      locale={enUS}
    />
  ),
}

export const DarkMode: Story = {
  render: () => (
    <div className="dark bg-background p-4 text-foreground">
      <SingleCalendar />
    </div>
  ),
}
