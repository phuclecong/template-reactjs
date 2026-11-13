import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"
import * as React from "react"

import {
  DateRangePicker,
  type DateRangePickerProps,
  type DateRangeValue,
} from "./date-range-picker"

const emptyValue: DateRangeValue = { from: "", to: "" }

function InteractiveDateRangePicker(props: DateRangePickerProps) {
  const [value, setValue] = React.useState(props.value)

  return <DateRangePicker {...props} value={value} onChange={setValue} />
}

function clickCalendarDay(date: Date) {
  const label = date.toLocaleDateString("en-US")
  const cell = document.querySelector<HTMLElement>(`[data-day="${label}"]`)
  if (!cell) throw new Error(`No calendar day found for ${label}`)
  return userEvent.click(cell)
}

const meta = {
  title: "Primitives/DateRangePicker",
  component: DateRangePicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    value: emptyValue,
    onChange: () => {},
    "aria-label": "Due date",
    placeholder: "Any due date",
    clearLabel: "Clear",
    locale: "en",
  },
  argTypes: {
    value: { control: "object" },
    onChange: { action: "change" },
    disabled: { control: "boolean" },
    locale: { control: "select", options: ["en", "vi"] },
    "aria-label": { control: "text" },
    placeholder: { control: "text" },
    clearLabel: { control: "text" },
    labels: { control: "object" },
  },
  render: (args) => <InteractiveDateRangePicker {...args} />,
} satisfies Meta<typeof DateRangePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const FullRange: Story = {
  args: { value: { from: "2026-01-05", to: "2026-01-10" } },
}

export const FromOnly: Story = {
  args: {
    value: { from: "2026-01-05", to: "" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))
    await userEvent.click(
      within(document.body).getByRole("button", { name: "From" })
    )
    await userEvent.click(
      within(document.body).getByRole("button", {
        name: /January 8th, 2026/,
      })
    )

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Jan 8, 2026")
  },
}

export const UntilOnly: Story = {
  args: {
    value: { from: "", to: "2026-01-10" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))
    await userEvent.click(
      within(document.body).getByRole("button", { name: "Until" })
    )
    await userEvent.click(
      within(document.body).getByRole("button", {
        name: /January 8th, 2026/,
      })
    )

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Jan 8, 2026")
  },
}

export const RangeSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    await clickCalendarDay(today)
    await clickCalendarDay(tomorrow)

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).not.toHaveTextContent("Any due date")
  },
}

export const Presets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))
    await userEvent.click(
      within(document.body).getByRole("button", { name: "Last 7 days" })
    )

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).not.toHaveTextContent("Any due date")
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("button", { name: "Last 7 days" })
      ).not.toBeInTheDocument()
    )
  },
}

export const Clear: Story = {
  args: { value: { from: "2026-01-05", to: "2026-01-10" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))
    await userEvent.click(
      within(document.body).getByRole("button", { name: "Clear" })
    )

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Any due date")
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).toBeDisabled()
  },
}

export const EnglishLocale: Story = {
  args: {
    locale: "en",
    value: { from: "2026-01-05", to: "2026-01-10" },
  },
}

export const VietnameseLocale: Story = {
  args: {
    locale: "vi",
    placeholder: "Mọi hạn chót",
    clearLabel: "Xóa",
    value: { from: "2026-01-05", to: "2026-01-10" },
    labels: {
      between: "Trong khoảng",
      from: "Từ",
      until: "Đến",
      today: "Hôm nay",
      last7Days: "7 ngày qua",
      thisMonth: "Tháng này",
      mode: "Chế độ lọc",
    },
  },
}

export const DarkMode: Story = {
  args: { value: { from: "2026-01-05", to: "2026-01-10" } },
  globals: { theme: "dark" },
}
