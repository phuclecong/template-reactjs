// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Refine, type DataProvider } from "@refinedev/core"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { UsersTable } from "@/features/users/components/users-table"
import type { CurrentUser } from "@/features/users/utils"
import { USER_SKELETON_COLUMN_WIDTHS } from "@/features/users/utils/column-widths"

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
]

const USERS = [
  {
    id: "usr_admin",
    name: "Ada Admin",
    email: "admin@example.com",
    roleId: "rol_admin",
    role: { id: "rol_admin", title: "Administrator", status: "active" },
  },
  {
    id: "usr_member",
    name: "Mia Member",
    email: "member@example.com",
    roleId: "rol_member",
    role: { id: "rol_member", title: "Member", status: "active" },
  },
]

const ADMIN: CurrentUser = { id: "usr_admin", roleId: "rol_admin" }
const MEMBER: CurrentUser = { id: "usr_member", roleId: "rol_member" }

type ListResult = { data: unknown[]; total: number }
type ListParams = { filters?: unknown[] }
type GetUsers = (params: ListParams) => Promise<ListResult>
type GetRoles = () => Promise<ListResult>
type ListCall = {
  resource: string
  filters?: unknown[]
  pagination?: { currentPage?: number; pageSize?: number }
}

const usersCalls = (calls: ListCall[]) =>
  calls.filter((call) => call.resource === "users")

/** Reports the router's current query string to assertions. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

/** A data provider whose Users and Roles lists answer with the given fakes. */
function makeDataProvider(
  getUsers: GetUsers,
  getRoles: GetRoles,
  onList?: (call: ListCall) => void
): DataProvider {
  return {
    getList: async ({
      resource,
      filters,
      pagination,
    }: {
      resource: string
      filters?: unknown[]
      pagination?: ListCall["pagination"]
    }) => {
      onList?.({ resource, filters, pagination })
      if (resource === "roles") return getRoles()
      if (resource === "users") return getUsers({ filters })
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
  getUsers = async () => ({ data: USERS, total: USERS.length }),
  getRoles = async () => ({ data: ROLES, total: ROLES.length }),
  currentUser = ADMIN,
  initialEntries = ["/users"],
}: {
  getUsers?: GetUsers
  getRoles?: GetRoles
  currentUser?: CurrentUser
  initialEntries?: string[]
} = {}) {
  const listCalls: ListCall[] = []
  const provider = makeDataProvider(getUsers, getRoles, (call) => {
    listCalls.push(call)
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <I18nextProvider i18n={i18n}>
          <Refine
            dataProvider={provider}
            resources={[{ name: "users" }, { name: "roles" }]}
            options={{
              syncWithLocation: false,
              disableTelemetry: true,
              // Refine owns the QueryClient; disable retries so a failure
              // surfaces immediately instead of after its default backoff.
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

  const result = render(<UsersTable currentUser={currentUser} />, {
    wrapper: Wrapper,
  })

  return { ...result, listCalls }
}

function skeletonWidths(container: HTMLElement): number[] {
  const firstRow = container.querySelector('[data-slot="table-skeleton-row"]')
  if (!firstRow) return []
  return Array.from(
    firstRow.querySelectorAll('[data-slot="table-skeleton-cell"]')
  ).map((cell) => Number((cell as HTMLElement).style.width.replace("px", "")))
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("UsersTable page frame", () => {
  it("renders the table inside the shared viewport-fitted page frame", async () => {
    const { container } = renderTable({ currentUser: ADMIN })

    const frame = container.querySelector(
      '[data-slot="table-page-layout"]'
    ) as HTMLElement | null
    expect(frame).not.toBeNull()
    expect(frame).toContainElement(await screen.findByRole("table"))
  })
})

describe("UsersTable loading state", () => {
  it("reserves the Users column widths and page size without fake table semantics", async () => {
    let resolveUsers!: (result: ListResult) => void
    const usersResponse = new Promise<ListResult>((resolve) => {
      resolveUsers = resolve
    })

    const { container } = renderTable({ getUsers: () => usersResponse })

    expect(screen.getByRole("status")).toHaveTextContent("Loading users…")
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("columnheader")).toBeNull()
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull()

    const rows = container.querySelectorAll('[data-slot="table-skeleton-row"]')
    expect(rows).toHaveLength(30)
    expect(skeletonWidths(container)).toEqual(USER_SKELETON_COLUMN_WIDTHS)

    // Resolve so the transition to the real table is exercised and no query is
    // left pending at unmount.
    resolveUsers({ data: USERS, total: USERS.length })
    expect(await screen.findByRole("cell", { name: "Ada Admin" })).toBeVisible()
    expect(screen.queryByRole("status")).toBeNull()
  })
})

describe("UsersTable error state", () => {
  it("offers an inline retry that reloads the list", async () => {
    const getUsers = vi
      .fn<GetUsers>()
      .mockRejectedValue({ message: "Backend unavailable" })

    renderTable({ getUsers })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load users.")
    expect(alert).toHaveTextContent("Backend unavailable")
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled()

    getUsers.mockResolvedValue({ data: USERS, total: USERS.length })
    const callsBeforeRetry = getUsers.mock.calls.length

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("cell", { name: "Ada Admin" })).toBeVisible()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(getUsers.mock.calls.length).toBe(callsBeforeRetry + 1)
  })
})

describe("UsersTable empty state", () => {
  it("shows the empty-list message when there are no users", async () => {
    renderTable({ getUsers: async () => ({ data: [], total: 0 }) })

    expect(await screen.findByText("No users yet.")).toBeVisible()
  })

  it("shows the no-match message when a Role filter is active", async () => {
    renderTable({
      getUsers: async () => ({ data: [], total: 0 }),
      initialEntries: ["/users?roleId=rol_member"],
    })

    expect(
      await screen.findByText("No users match your search or filters.")
    ).toBeVisible()
  })
})

describe("UsersTable role filter", () => {
  it("sends the selected Role as an eq filter", async () => {
    const getUsers = vi.fn<GetUsers>(async () => ({
      data: USERS,
      total: USERS.length,
    }))

    renderTable({ getUsers })
    await screen.findByRole("cell", { name: "Ada Admin" })

    const user = userEvent.setup()
    await user.click(screen.getByRole("combobox", { name: "Role" }))
    await user.click(await screen.findByRole("option", { name: "Member" }))

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith({
        filters: [{ field: "roleId", operator: "eq", value: "rol_member" }],
      })
    )
  })
})

describe("UsersTable URL state", () => {
  it("keeps a role-filtered deep link on page 2 after the Roles list resolves", async () => {
    let resolveRoles!: (result: ListResult) => void
    const rolesResponse = new Promise<ListResult>((resolve) => {
      resolveRoles = resolve
    })
    const getUsers = vi.fn<GetUsers>(async () => ({ data: USERS, total: 90 }))

    const { listCalls } = renderTable({
      getUsers,
      getRoles: () => rolesResponse,
      initialEntries: ["/users?roleId=rol_member&page=2"],
    })

    // The deep link seeds the first Users request with page 2.
    await waitFor(() => expect(getUsers).toHaveBeenCalled())
    expect(usersCalls(listCalls)[0]?.pagination?.currentPage).toBe(2)

    await act(async () => {
      resolveRoles({ data: ROLES, total: ROLES.length })
    })

    // The Role filter shows its fetched title once the Roles list lands.
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Role" })).toHaveValue(
        "Member"
      )
    )

    // Resolving Roles must not rebuild the columns in a way that resets the
    // restored page or rewrites it out of the URL.
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("page=2")
    )
    expect(
      usersCalls(listCalls).every((call) => call.pagination?.currentPage === 2)
    ).toBe(true)
  })

  it("does not wipe a filter committed after mount when the Roles list resolves", async () => {
    let resolveRoles!: (result: ListResult) => void
    const rolesResponse = new Promise<ListResult>((resolve) => {
      resolveRoles = resolve
    })
    const getUsers = vi.fn<GetUsers>(async () => ({
      data: USERS,
      total: USERS.length,
    }))

    renderTable({ getUsers, getRoles: () => rolesResponse })

    await screen.findByRole("cell", { name: "Ada Admin" })

    const user = userEvent.setup()
    await user.type(
      screen.getByRole("textbox", { name: "Search users" }),
      "ada"
    )

    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith({
        filters: [{ field: "q", operator: "contains", value: "ada" }],
      })
    )

    await act(async () => {
      resolveRoles({ data: ROLES, total: ROLES.length })
    })

    // Open the Role filter: its fetched options prove the Roles query has
    // resolved and the table has re-rendered.
    await user.click(screen.getByRole("combobox", { name: "Role" }))
    await screen.findByRole("option", { name: "Member" })

    // The post-mount search filter survives with its value intact rather than
    // being replaced by an `undefined` value when the columns change.
    await waitFor(() =>
      expect(getUsers).toHaveBeenLastCalledWith({
        filters: [{ field: "q", operator: "contains", value: "ada" }],
      })
    )
    expect(screen.getByTestId("location-search")).toHaveTextContent("q=ada")
  })
})

describe("UsersTable member access", () => {
  it("shows Role titles but no role assignment or delete controls", async () => {
    renderTable({ currentUser: MEMBER })

    expect(
      await screen.findByRole("cell", { name: "Administrator", exact: true })
    ).toBeVisible()
    expect(
      screen.getByRole("cell", { name: "Member", exact: true })
    ).toBeVisible()
    expect(screen.queryByLabelText("Role for Ada Admin")).toBeNull()
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()
  })
})
