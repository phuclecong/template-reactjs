// @vitest-environment jsdom
import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Refine, type DataProvider } from "@refinedev/core"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import {
  RoleFormDrawer,
  type RoleFormDrawerHandle,
} from "@/features/roles/components/role-form-drawer"

const ROLES: Record<string, unknown> = {
  rol_admin: {
    id: "rol_admin",
    title: "Administrator",
    description: "Full access to every resource.",
    status: "active",
    createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  rol_demo_01: {
    id: "rol_demo_01",
    title: "Demo Role 01",
    description: "A demo role.",
    status: "active",
    createdAt: "2025-12-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
  },
}

const dataProvider = {
  getOne: async ({ id }: { id: string }) => ({
    data: ROLES[id as string],
  }),
} as unknown as DataProvider

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

async function openEdit(roleId: string) {
  const ref = createRef<RoleFormDrawerHandle>()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Refine
          dataProvider={dataProvider}
          resources={[{ name: "roles" }]}
          options={{ syncWithLocation: false, disableTelemetry: true }}
        >
          <RoleFormDrawer ref={ref} />
        </Refine>
      </I18nextProvider>
    </QueryClientProvider>
  )

  ref.current?.openEdit(roleId)
  // The sheet mounts one animation frame after `open`; wait for its content.
  await screen.findByRole("heading", { name: "Edit role" })
  return userEvent.setup()
}

async function statusOptions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Status" }))
  return screen.findAllByRole("option")
}

describe("RoleFormDrawer edit status", () => {
  it("omits Inactive for a System Role", async () => {
    const user = await openEdit("rol_admin")
    const options = await statusOptions(user)

    expect(options.map((option) => option.textContent)).toEqual(["Active"])
  })

  it("offers Inactive for an ordinary Role", async () => {
    const user = await openEdit("rol_demo_01")
    const options = await statusOptions(user)

    expect(options.map((option) => option.textContent)).toEqual([
      "Active",
      "Inactive",
    ])
  })
})
