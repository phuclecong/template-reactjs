import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, waitFor, within } from "@storybook/test"

import { Button } from "./button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible"

const meta = {
  title: "Primitives/Collapsible",
  component: Collapsible,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Collapsible>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Collapsible defaultOpen>
      <CollapsibleTrigger render={<Button variant="outline" />}>
        Toggle
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 max-w-xs text-sm">
          Content that collapses and expands with the trigger.
        </p>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Toggle" })
    const content = canvas.getByText(
      "Content that collapses and expands with the trigger."
    )

    await expect(content).toBeVisible()

    await userEvent.click(trigger)
    await waitFor(() =>
      expect(
        canvas.queryByText(
          "Content that collapses and expands with the trigger."
        )
      ).not.toBeInTheDocument()
    )

    await userEvent.click(trigger)
    await expect(
      await canvas.findByText(
        "Content that collapses and expands with the trigger."
      )
    ).toBeVisible()
  },
}
