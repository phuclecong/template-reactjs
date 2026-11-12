import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "./button"

describe("Button", () => {
  it("calls onClick when the user clicks it", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<Button onClick={onClick}>Save</Button>)

    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toBeInTheDocument()

    await user.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
