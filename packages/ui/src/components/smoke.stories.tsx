import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"
import { useState } from "react"

import { Button } from "./button"

/**
 * Minimal stateful component used to prove the Storybook interaction-test
 * harness is wired up: the `play` function below drives a real click and
 * asserts the rendered result.
 */
function ClickCounter() {
  const [count, setCount] = useState(0)

  return (
    <Button onClick={() => setCount((current) => current + 1)}>
      Clicked {count} {count === 1 ? "time" : "times"}
    </Button>
  )
}

const meta = {
  title: "Testing/Smoke",
  component: ClickCounter,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ClickCounter>

export default meta
type Story = StoryObj<typeof meta>

export const PlayFunction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(
      canvas.getByRole("button", { name: "Clicked 0 times" })
    )

    await expect(
      canvas.getByRole("button", { name: "Clicked 1 time" })
    ).toBeVisible()
  },
}
