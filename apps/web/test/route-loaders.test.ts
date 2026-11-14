import { beforeEach, describe, expect, it, vi } from "vitest"

const loads = vi.hoisted(() => ({
  login: 0,
  register: 0,
  tasks: 0,
  users: 0,
  settings: 0,
}))

const ensureMockWorker = vi.hoisted(() => vi.fn(async () => {}))
vi.mock("@/utils/mock-worker", () => ({ ensureMockWorker }))

function page() {
  return () => null
}

vi.mock("@/routes/login", () => {
  loads.login += 1
  return { LoginPage: page() }
})
vi.mock("@/routes/register", () => {
  loads.register += 1
  return { RegisterPage: page() }
})
vi.mock("@/routes/tasks", () => {
  loads.tasks += 1
  return { TasksPage: page() }
})
vi.mock("@/routes/users", () => {
  loads.users += 1
  return { UsersPage: page() }
})
vi.mock("@/routes/settings", () => {
  loads.settings += 1
  return { SettingsPage: page() }
})

import { prefetchRoute, routeLoaders } from "@/routes/route-loaders"

describe("route loaders", () => {
  beforeEach(() => {
    ensureMockWorker.mockClear()
  })

  it("does not import a route module merely by importing the loader map", () => {
    expect(loads).toEqual({
      login: 0,
      register: 0,
      tasks: 0,
      users: 0,
      settings: 0,
    })
    expect(ensureMockWorker).not.toHaveBeenCalled()
  })

  it("loads only the prefetched route", async () => {
    await prefetchRoute("/dashboard/tasks")

    expect(loads.tasks).toBe(1)
    expect(loads.users).toBe(0)
    expect(loads.settings).toBe(0)
    expect(loads.login).toBe(0)
    expect(loads.register).toBe(0)
  })

  it("starts the mock worker alongside the authenticated tasks route", async () => {
    await prefetchRoute("/dashboard/tasks")

    expect(ensureMockWorker).toHaveBeenCalledTimes(1)
  })

  it("never starts the mock worker for the anonymous login route", async () => {
    await prefetchRoute("/login")

    expect(ensureMockWorker).not.toHaveBeenCalled()
  })

  it("wraps each named route export as the default component lazy expects", async () => {
    const tasks = await routeLoaders["/dashboard/tasks"]()
    const settings = await routeLoaders["/dashboard/settings"]()

    expect(typeof tasks.default).toBe("function")
    expect(typeof settings.default).toBe("function")
  })

  it("ignores paths that have no route chunk", async () => {
    await expect(prefetchRoute("/dashboard/unknown")).resolves.toBeUndefined()
    await expect(prefetchRoute("toString")).resolves.toBeUndefined()
  })
})
