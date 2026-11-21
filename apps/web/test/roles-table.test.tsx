// @vitest-environment jsdom
import type { ReactNode } from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import { Refine, type AccessControlProvider, type DataProvider } from "@refinedev/core"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import { RolesTable } from "@/features/roles/components/roles-table"
import type { CurrentUser } from "@/features/users/utils"
import { isAdministratorRole } from "@workspace/api/policy"

const ROLES = [
  {
    id: "rol_admin",
    title: "Administrator",
    description: "",
    status: "active",
    createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "rol_member",
    title: "Member",
    description: "",
    status: "active",
    createdAt: "2025-12-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "rol_editor",
    title: "Editor",
    description: "",
    status: "active",
    createdAt: "2025-12-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
  },
]

const ADMIN: CurrentUser = { id: "usr_admin", roleId: "rol_admin" }
const MEMBER: CurrentUser = { id: "usr_member", roleId: "rol_member" }

type ListResult = { data: unknown[]; total: number }
type ListParams = { pagination?: { currentPage?: number } }
type GetRoles = (params: ListParams) => Promise<ListResult>
type ListCall = {
  resource: string
  pagination?: { currentPage?: number; pageSize?: number }
}

/** Reports the router's current query string to assertions. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

/** Mirrors the app provider's matrix: admin all, member list-only. */
function makeAccessControl(
  currentUser: CurrentUser,
  gate?: Promise<void>
): AccessControlProvider {
  return {
    can: async ({ resource, action }) => {
      if (gate) await gate
      if (isAdministratorRole(currentUser.roleId)) return { can: true }
      if (resource === "users" || resource === "roles") {
        return { can: action === "list" }
      }
      return { can: true }
    },
  }
}

function makeDataProvider(
  getRoles: GetRoles,
  onList?: (call: ListCall) => void
): DataProvider {
  return {
    getList: async ({
      resource,
      pagination,
    }: {
      resource: string
      pagination?: ListCall["pagination"]
    }) => {
      onList?.({ resource, pagination })
      if (resource === "roles") return getRoles({ pagination })
      return { data: [], total: 0 }
    },
    getOne: async () => ({ data: {} }),
    create: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
    deleteOne: async () => ({ data: {} }),
    getApiUrl: () => "/api",
  } as unknown as DataProvider
}

function renderTable({
  getRoles = async () => ({ data: ROLES, total: ROLES.length }),
  currentUser = ADMIN,
  initialEntries = ["/roles"],
  gate,
}: {
  getRoles?: GetRoles
  currentUser?: CurrentUser
  initialEntries?: string[]
  gate?: Promise<void>
} = {}) {
  const listCalls: ListCall[] = []
  const provider = makeDataProvider(getRoles, (call) => {
    listCalls.push(call)
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <I18nextProvider i18n={i18n}>
          <Refine
            dataProvider={provider}
            accessControlProvider={makeAccessControl(currentUser, gate)}
            resources={[{ name: "roles" }]}
            options={{
              syncWithLocation: false,
              disableTelemetry: true,
              reactQuery: {
                clientConfig: {
                  defaultOptions: { queries: { retry: false } },
                },
              },
            }}
          >
            {children}
          </Refine>
        </I18nextProvider>
        <LocationProbe />
      </MemoryRouter>
    )
  }

  const result = render(<RolesTable />, { wrapper: Wrapper })
  return { ...result, listCalls }
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("RolesTable page frame", () => {
  it("renders the table inside the shared viewport-fitted page frame", async () => {
    const { container } = renderTable({ currentUser: ADMIN })

    const frame = container.querySelector(
      '[data-slot="table-page-layout"]'
    ) as HTMLElement | null
    expect(frame).not.toBeNull()
    expect(frame).toContainElement(await screen.findByRole("table"))
  })
})

describe("RolesTable access gating", () => {
  it("shows the selection and actions columns to an administrator", async () => {
    renderTable({ currentUser: ADMIN })

    expect(
      await screen.findByRole("columnheader", { name: "Actions" })
    ).toBeVisible()
    expect(
      await screen.findByRole("checkbox", {
        name: "Select all roles on this page",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("checkbox", { name: "Select Administrator" })
    ).toBeVisible()
  })

  it("hides the selection and actions columns from a member", async () => {
    renderTable({ currentUser: MEMBER })

    // Wait for the loaded table before asserting absence so the check is not
    // satisfied by the loading skeleton.
    expect(await screen.findByRole("cell", { name: "Administrator" })).toBeVisible()

    await waitFor(() =>
      expect(
        screen.queryByRole("columnheader", { name: "Actions" })
      ).toBeNull()
    )
    expect(screen.queryByRole("checkbox")).toBeNull()
  })
})

describe("RolesTable URL state", () => {
  it("keeps a deep-linked page 2 after access resolves", async () => {
    let releaseAccess!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseAccess = resolve
    })
    const getRoles = async () => ({ data: ROLES, total: 90 })

    const { listCalls } = renderTable({
      getRoles,
      currentUser: ADMIN,
      initialEntries: ["/roles?page=2"],
      gate,
    })

    // The data request is not blocked by access resolution.
    expect(await screen.findByRole("cell", { name: "Administrator" })).toBeVisible()
    expect(
      listCalls.find((call) => call.resource === "roles")?.pagination
        ?.currentPage
    ).toBe(2)

    releaseAccess()

    // Resolving access reveals the gated columns without resetting the page.
    expect(
      await screen.findByRole("columnheader", { name: "Actions" })
    ).toBeVisible()
    expect(screen.getByTestId("location-search")).toHaveTextContent("page=2")
    expect(
      listCalls
        .filter((call) => call.resource === "roles")
        .every((call) => call.pagination?.currentPage === 2)
    ).toBe(true)
  })
})

describe("RolesTable system roles", () => {
  it("offers no Delete action for a System Role but does for a custom Role", async () => {
    renderTable({ currentUser: ADMIN })

    const adminCell = await screen.findByRole("cell", {
      name: "Administrator",
    })
    const memberCell = screen.getByRole("cell", { name: "Member" })
    const editorCell = screen.getByRole("cell", { name: "Editor" })

    const adminRow = adminCell.closest("tr")
    const memberRow = memberCell.closest("tr")
    const editorRow = editorCell.closest("tr")
    expect(adminRow).not.toBeNull()
    expect(memberRow).not.toBeNull()
    expect(editorRow).not.toBeNull()

    expect(within(adminRow!).getByRole("button", { name: "Edit" })).toBeVisible()
    expect(within(memberRow!).getByRole("button", { name: "Edit" })).toBeVisible()
    expect(within(adminRow!).queryByRole("button", { name: "Delete" })).toBeNull()
    expect(within(memberRow!).queryByRole("button", { name: "Delete" })).toBeNull()
    expect(
      within(editorRow!).getByRole("button", { name: "Delete" })
    ).toBeVisible()
  })
})
