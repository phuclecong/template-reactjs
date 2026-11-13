import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import { Field, FieldDescription, FieldError, FieldLabel } from "./field"
import { Input } from "./input"

const meta = {
  title: "Primitives/Field",
  component: Field,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="field-email">Email</FieldLabel>
        <Input id="field-email" type="email" placeholder="you@example.com" />
        <FieldDescription>We&apos;ll never share your email.</FieldDescription>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="field-recovery-invalid">Recovery email</FieldLabel>
        <Input
          id="field-recovery-invalid"
          aria-invalid
          defaultValue="not-an-email"
        />
        <FieldError errors={[{ message: "Enter a valid email address." }]} />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByRole("textbox", { name: "Email" })
    const recovery = canvas.getByRole("textbox", { name: "Recovery email" })

    // Label association: the accessible name comes from FieldLabel.
    await expect(
      canvas.getByText("We'll never share your email.")
    ).toBeVisible()
    await userEvent.type(email, "paul@example.com")
    await expect(email).toHaveValue("paul@example.com")

    // Invalid styling semantics: aria-invalid drives the error treatment and
    // the message is announced as an alert.
    await expect(recovery).toHaveAttribute("aria-invalid", "true")
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address."
    )
  },
}
