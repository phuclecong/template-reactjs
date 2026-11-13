import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"
import { SearchIcon } from "lucide-react"

import { Field, FieldError, FieldLabel } from "./field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "./input-group"

function SearchInputGroup() {
  return (
    <InputGroup className="w-72">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
        <InputGroupText>Search</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput aria-label="Search tasks" placeholder="Search tasks…" />
    </InputGroup>
  )
}

function ClearableInputGroup() {
  const [value, setValue] = useState("")

  return (
    <InputGroup className="w-72">
      <InputGroupInput
        aria-label="Filter tasks"
        placeholder="Filter tasks…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <InputGroupButton aria-label="Clear filter" onClick={() => setValue("")}>
        Clear
      </InputGroupButton>
    </InputGroup>
  )
}

const meta = {
  title: "Primitives/InputGroup",
  component: InputGroup,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SearchInputGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Search tasks" })

    // Clicking the addon focuses the group's input.
    await userEvent.click(canvas.getByText("Search"))
    await expect(input).toHaveFocus()

    await userEvent.keyboard("design")
    await expect(input).toHaveValue("design")
  },
}

export const WithButton: Story = {
  render: () => <ClearableInputGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Filter tasks" })

    await userEvent.type(input, "design")
    await expect(input).toHaveValue("design")

    await userEvent.click(canvas.getByRole("button", { name: "Clear filter" }))
    await expect(input).toHaveValue("")
  },
}

export const Disabled: Story = {
  render: () => (
    <InputGroup className="w-72">
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Search tasks"
        placeholder="Search tasks…"
        disabled
      />
    </InputGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("textbox", { name: "Search tasks" })
    ).toBeDisabled()
  },
}

export const Invalid: Story = {
  render: () => (
    <Field data-invalid>
      <FieldLabel htmlFor="input-group-email">Email</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="input-group-email"
          aria-invalid
          aria-describedby="input-group-email-error"
          defaultValue="not-an-email"
        />
      </InputGroup>
      <FieldError
        id="input-group-email-error"
        errors={[{ message: "Enter a valid email address." }]}
      />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("textbox", { name: "Email" })
    ).toHaveAttribute("aria-invalid", "true")
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address."
    )
  },
}
