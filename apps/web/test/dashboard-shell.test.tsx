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
  it("places the scroll region below the fixed header, not around it", () => {
    const { container } = renderShell()

    const wrapper = container.querySelector('[data-slot="sidebar-wrapper"]')
    expect(wrapper).not.toBeNull()

    const inset = container.querySelector('[data-slot="sidebar-inset"]')
    expect(inset).not.toBeNull()

    // The header is the fixed band and the route content scrolls below it, so
    // the header must stay outside the scrolling region.
    const header = inset?.querySelector<HTMLElement>("header") ?? null
    expect(header).not.toBeNull()

    const content = container.querySelector<HTMLElement>(
      '[data-slot="shell-content"]'
    )
    expect(content).not.toBeNull()
    expect(inset).toContainElement(content)
    expect(content).not.toContainElement(header)
    expect(header?.nextElementSibling).toBe(content)
    expect(content).toContainElement(screen.getByText("Page content"))
  })
})
