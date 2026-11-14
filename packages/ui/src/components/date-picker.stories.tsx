import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, fireEvent, screen, userEvent, within } from "@storybook/test"

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
  title: "Primitives/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    value: null,
    onChange: () => {},
    locale: "en",
    placeholder: "Pick a date",
    labels: {
      clear: "Clear",
      done: "Done",
      time: "Time",
      typedEntryLabel: "Date and time",
      typedEntryHint: "Format: {format}",
      typedEntryError: "Enter a valid date and time.",
    },
    "aria-label": "Due date",
  },
  argTypes: {
    onChange: { control: false },
    onDone: { control: false },
    onOpenChange: { control: false },
    labels: { control: "object" },
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
    await expect(screen.getByLabelText("Time")).toBeInTheDocument()
  },
}

export const WithTime: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Due date" })

    await userEvent.click(trigger)
    await userEvent.click(
      await screen.findByRole("button", { name: /January 20/ })
    )

    // The popped-over time control is portalled, so query it on `screen`.
    const time = await screen.findByLabelText("Time")
    fireEvent.change(time, { target: { value: "14:30" } })

    await expect(trigger).toHaveTextContent("Jan 20, 2026, 2:30 PM")
    await userEvent.click(screen.getByRole("button", { name: "Done" }))

    await expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()
  },
}

export const TypedEntry: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Due date" })

    await userEvent.click(trigger)
    const typed = await screen.findByLabelText("Date and time")
    await userEvent.clear(typed)
    await userEvent.type(typed, "01/20/2026 2:30 PM")
    await userEvent.keyboard("{Enter}")

    await expect(trigger).toHaveTextContent("Jan 20, 2026, 2:30 PM")
    await expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  },
}

export const TypedEntryInvalid: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Due date" })

    await userEvent.click(trigger)
    const typed = await screen.findByLabelText("Date and time")
    await userEvent.clear(typed)
    await userEvent.type(typed, "tomorrow at noon")
    await userEvent.keyboard("{Enter}")

    await expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid date and time."
    )
    // The invalid text does not change the selected value.
    await expect(trigger).toHaveTextContent("Jan 15, 2026")
  },
}

export const DoneAndClear: Story = {
  render: () => (
    <ControlledDatePicker initialValue={january2026} aria-label="Due date" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Due date" })

    await userEvent.click(trigger)
    await userEvent.click(
      await screen.findByRole("button", { name: /January 20/ })
    )
    await userEvent.click(screen.getByRole("button", { name: "Done" }))
    await expect(screen.queryByLabelText("Time")).not.toBeInTheDocument()

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }))

    await expect(trigger).toHaveTextContent("Pick a date")
    await expect(trigger).toHaveFocus()
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

    // The popover stays open after selecting; Esc closes and restores focus.
    await userEvent.keyboard("{Escape}")
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: "Due date" }))

    await expect(
      await screen.findByRole("button", { name: /January 9/ })
    ).toBeDisabled()
    await expect(
      screen.getByRole("button", { name: /January 10/ })
    ).toBeEnabled()
    await expect(
      screen.getByRole("button", { name: /January 20/ })
    ).toBeEnabled()
    await expect(
      screen.getByRole("button", { name: /January 21/ })
    ).toBeDisabled()
  },
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

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <label htmlFor="labeled-date-picker">Due date</label>
      <DatePicker id="labeled-date-picker" placeholder="Pick a date" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Due date" })
    ).toHaveTextContent("Pick a date")
  },
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
      labels={{
        clear: "Xóa",
        done: "Xong",
        time: "Thời gian",
        typedEntryLabel: "Ngày và giờ",
        typedEntryHint: "Định dạng: {format}",
        typedEntryError: "Vui lòng nhập ngày và giờ hợp lệ.",
      }}
      aria-label="Hạn chót"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Hạn chót" })
    ).toHaveTextContent("00:00 15 thg 1, 2026")
  },
}
