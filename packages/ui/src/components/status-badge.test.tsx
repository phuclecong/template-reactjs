import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "./status-badge"

describe("StatusBadge", () => {
  it("renders an active status in green", () => {
    render(<StatusBadge status="active">Active</StatusBadge>)

    const badge = screen.getByText("Active")
    expect(badge).toHaveAttribute("data-slot", "badge")
    expect(badge).toHaveClass("bg-green-100", "text-green-800")
  })

  it("renders an inactive status in grey", () => {
    render(<StatusBadge status="inactive">Inactive</StatusBadge>)

    const badge = screen.getByText("Inactive")
    expect(badge).toHaveAttribute("data-slot", "badge")
    expect(badge).toHaveClass("bg-muted", "text-muted-foreground")
  })
})
