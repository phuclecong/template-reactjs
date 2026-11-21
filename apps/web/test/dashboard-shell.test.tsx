// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router-dom"
import { Refine, type DataProvider } from "@refinedev/core"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import { DashboardShell } from "@/components/dashboard-shell"
import type { DashboardUser } from "@/providers/auth-provider"

const USER: DashboardUser = {
  name: "Ada Admin",
  email: "admin@example.com",
  role: { id: "rol_admin", title: "Administrator", status: "active" },
}

const dataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  create: async () => ({ data: {} }),
  update: async () => ({ data: {} }),
  deleteOne: async () => ({ data: {} }),
  getApiUrl: () => "/api",
} as unknown as DataProvider

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <I18nextProvider i18n={i18n}>
        <Refine
          dataProvider={dataProvider}
          options={{ syncWithLocation: false, disableTelemetry: true }}
        >
          <DashboardShell user={USER}>
            <div>Page content</div>
          </DashboardShell>
        </Refine>
      </I18nextProvider>
    </MemoryRouter>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("DashboardShell viewport frame", () => {
  it("locks the shell to the viewport and makes the inset the scroll region", () => {
    const { container } = renderShell()

    const wrapper = container.querySelector(
      '[data-slot="sidebar-wrapper"]'
    ) as HTMLElement
    expect(wrapper).toHaveClass("h-svh", "overflow-hidden")

    const inset = container.querySelector(
      '[data-slot="sidebar-inset"]'
    ) as HTMLElement
    expect(inset).toHaveClass(
      "min-h-0",
      "flex-1",
      "flex-col",
      "overflow-y-auto"
    )

    // The header is the fixed band; the route content scrolls below it.
    const header = inset.querySelector("header") as HTMLElement
    expect(header).toHaveClass("sticky", "top-0", "h-12", "shrink-0")
    expect(screen.getByText("Page content")).toBeInTheDocument()
  })
})
