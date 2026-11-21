// @vitest-environment jsdom
import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Refine, type DataProvider } from "@refinedev/core"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import { TasksTable } from "@/features/tasks/components/tasks-table"
import type { CurrentUser } from "@/features/users/utils"

const USERS = [
  { id: "usr_admin", name: "Ada Admin" },
  { id: "usr_member", name: "Mia Member" },
]

const MEMBER: CurrentUser = { id: "usr_member", roleId: "rol_member" }

const TASKS = [
  {
    id: "tsk_mine",
    title: "Mine to edit",
    description: null,
    status: "todo",
    priority: "high",
    assigneeId: "usr_member",
    dueDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "tsk_theirs",
    title: "Someone else's task",
    description: null,
    status: "todo",
    priority: "low",
    assigneeId: "usr_admin",
    dueDate: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
]

const UNOWNED_TASKS = TASKS.map((task) => ({
  ...task,
  id: `${task.id}_admin`,
  assigneeId: "usr_admin",
}))

type ListResult = { data: unknown[]; total: number }
type ListParams = { pagination?: { currentPage?: number } }
type GetList = (params: ListParams) => Promise<ListResult>

function makeDataProvider(
  getTasks: GetList,
  getUsers: GetList = async () => ({ data: USERS, total: USERS.length })
): DataProvider {
  return {
    getList: async ({ resource }: { resource: string }) => {
      if (resource === "tasks") return getTasks({})
      if (resource === "users") return getUsers({})
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
  getTasks = async () => ({ data: TASKS, total: TASKS.length }),
  currentUser = MEMBER,
}: {
  getTasks?: GetList
  currentUser?: CurrentUser
} = {}) {
  const provider = makeDataProvider(getTasks)

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/tasks"]}>
        <I18nextProvider i18n={i18n}>
          <Refine
            dataProvider={provider}
            resources={[{ name: "tasks" }, { name: "users" }]}
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
      </MemoryRouter>
    )
  }

  return render(<TasksTable currentUser={currentUser} />, { wrapper: Wrapper })
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("TasksTable predicate selection", () => {
  it("disables only the checkbox of a task the current user cannot modify", async () => {
    renderTable({ currentUser: MEMBER })

    const mine = await screen.findByRole("checkbox", {
      name: "Select Mine to edit",
    })
    const theirs = screen.getByRole("checkbox", {
      name: "Select Someone else's task",
    })

    expect(mine).not.toHaveAttribute("aria-disabled", "true")
    expect(theirs).toHaveAttribute("aria-disabled", "true")
  })

  it("disables select-all when no row is selectable", async () => {
    renderTable({
      currentUser: MEMBER,
      getTasks: async () => ({
        data: UNOWNED_TASKS,
        total: UNOWNED_TASKS.length,
      }),
    })

    await screen.findByRole("checkbox", {
      name: "Select Mine to edit",
    })
    expect(
      screen.getByRole("checkbox", { name: "Select all tasks" })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("shows the bulk bar only after selecting a selectable row", async () => {
    const user = userEvent.setup()
    renderTable({ currentUser: MEMBER })

    const mine = await screen.findByRole("checkbox", {
      name: "Select Mine to edit",
    })
    expect(
      screen.queryByRole("region", { name: "Bulk actions" })
    ).toBeNull()

    await user.click(mine)

    expect(
      await screen.findByRole("region", { name: "Bulk actions" })
    ).toHaveTextContent("1 selected")
  })

  it("does not show the bulk bar when a disabled row is clicked", async () => {
    const user = userEvent.setup()
    renderTable({ currentUser: MEMBER })

    const theirs = await screen.findByRole("checkbox", {
      name: "Select Someone else's task",
    })
    await user.click(theirs)

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Bulk actions" })
      ).toBeNull()
    )
  })
})
