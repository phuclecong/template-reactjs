// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

const prefetchRoute = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock("@/routes/route-loaders", () => ({ prefetchRoute }))

import { IntentLink } from "@/components/intent-link"

function renderLink() {
  return render(
    <MemoryRouter>
      <IntentLink to="/dashboard/settings">Settings</IntentLink>
    </MemoryRouter>
  )
}

describe("IntentLink", () => {
  it("is a real link and does not prefetch merely by mounting", () => {
    renderLink()

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/dashboard/settings"
    )
    expect(prefetchRoute).not.toHaveBeenCalled()
  })

  it("prefetches its route on pointer enter", () => {
    renderLink()

    fireEvent.pointerEnter(screen.getByRole("link", { name: "Settings" }))

    expect(prefetchRoute).toHaveBeenCalledExactlyOnceWith("/dashboard/settings")
  })

  it("prefetches its route on keyboard focus", () => {
    renderLink()

    fireEvent.focus(screen.getByRole("link", { name: "Settings" }))

    expect(prefetchRoute).toHaveBeenCalledExactlyOnceWith("/dashboard/settings")
  })

  it("prefetches its route on pointer down", () => {
    renderLink()

    fireEvent.pointerDown(screen.getByRole("link", { name: "Settings" }))

    expect(prefetchRoute).toHaveBeenCalledExactlyOnceWith("/dashboard/settings")
  })
})
