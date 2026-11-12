import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, screen, userEvent, within } from "@storybook/test"

import { Field, FieldError, FieldLabel } from "./field"
import { DatePicker } from "./date-picker"

// Local midnight keeps the displayed calendar day stable in every timezone.
const january2026 = new Date(2026, 0, 15).toISOString()

function ControlledDatePicker(
  props: Omit<React.ComponentProps<typeof DatePicker>, "value" | "onChange"> & {
    initialValue?: string | null
  }
) {
  const { initialValue = null, placeholder = "Pick a date", ...rest } = props
  const [value, setValue] = React.useState<string | null>(initialValue)

  return (
    <div className="w-64">
      <DatePicker
        {...rest}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
      />
    </div>
  )
}

const meta = {
  title: "Components/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    value: null,
    onChange: () => {},
    locale: "en",
    placeholder: "Pick a date",
    clearLabel: "Clear",
    "aria-label": "Due date",
  },
  argTypes: {
    onChange: { control: false },
    min: { control: "text" },
    max: { control: "text" },
  },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <ControlledDatePicker aria-label="Due date" />,
}

export const WithValue: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))
    await userEvent.click(
      await screen.findByRole("button", { name: /January 20/ })
    )

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Jan 20, 2026")
  },
}

export const Clearable: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Due date" })

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }))

    await expect(trigger).toHaveTextContent("Pick a date")
  },
}

export const Keyboard: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Due date" })

    trigger.focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{Enter}")

    await expect(trigger).toHaveTextContent("Jan 16, 2026")
    await expect(trigger).toHaveFocus()
  },
}

export const WithMinMax: Story = {
  render: () => (
    <ControlledDatePicker
      initialValue={january2026}
      min="2026-01-10T00:00:00.000Z"
      max="2026-01-20T00:00:00.000Z"
      aria-label="Due date"
    />
  ),
}

export const Disabled: Story = {
  render: () => (
    <ControlledDatePicker
      initialValue={january2026}
      disabled
      aria-label="Due date"
    />
  ),
}

export const WithError: Story = {
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="due-date-error">Due date</FieldLabel>
      <DatePicker
        id="due-date-error"
        placeholder="Pick a date"
        aria-invalid
        aria-describedby="due-date-error-message"
      />
      <FieldError
        id="due-date-error-message"
        errors={[{ message: "Enter a valid Due date." }]}
      />
    </Field>
  ),
}

export const DarkMode: Story = {
  globals: { theme: "dark" },
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
}

export const VietnameseLocale: Story = {
  render: () => (
    <ControlledDatePicker
      initialValue={january2026}
      locale="vi"
      placeholder="Chọn ngày"
      clearLabel="Xóa"
      aria-label="Hạn chót"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Hạn chót" })
    ).toHaveTextContent("15 thg 1, 2026")
  },
}
