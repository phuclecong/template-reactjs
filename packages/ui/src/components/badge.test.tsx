import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Badge } from "./badge"

describe("Badge", () => {
  it("renders its content as an inline status label", () => {
    render(<Badge>Active</Badge>)

    const badge = screen.getByText("Active")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute("data-slot", "badge")
  })

  it("lets callers override the rendered variant classes", () => {
    render(<Badge className="bg-green-100 text-green-800">Active</Badge>)

    expect(screen.getByText("Active")).toHaveClass(
      "bg-green-100",
      "text-green-800"
    )
  })
})
