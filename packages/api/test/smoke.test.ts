import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import { setupServer } from "msw/node"
import { handlers, resetDb, tasks } from "../src/index"

// The read path interprets legacy date-only records as local midnight. Pin the
// test process to UTC so the expected instants are deterministic.
const originalTimeZone = process.env.TZ
process.env.TZ = "UTC"

const server = setupServer(...handlers)

const BASE_URL = "http://localhost"

interface ApiOptions {
  method?: string
  token?: string
  body?: unknown
}

async function api(path: string, options: ApiOptions = {}): Promise<Response> {
  const { method = "GET", token, body } = options
  const headers = new Headers()
  if (token) headers.set("authorization", `Bearer ${token}`)
  if (body !== undefined) headers.set("content-type", "application/json")

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function login(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as {
    accessToken: string
    refreshToken: string
  }
}

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  server.resetHandlers()
  process.env.TZ = "UTC"
})
afterAll(() => {
  server.close()
  process.env.TZ = originalTimeZone
})
beforeEach(async () => {
  await resetDb()
})

describe("auth", () => {
  it("registers an account and logs in", async () => {
    const register = await api("/api/auth/register", {
      method: "POST",
      body: { name: "New User", email: "new@example.com", password: "secret" },
    })
    expect(register.status).toBe(201)
    const registered = (await register.json()) as {
      accessToken: string
      refreshToken: string
      user: { id: string; email: string; role: string }
    }
    expect(registered.accessToken).toBeTruthy()
    expect(registered.refreshToken).toBeTruthy()
    expect(registered.user.role).toBe("member")
    expect(registered.user.email).toBe("new@example.com")

    const loginRes = await api("/api/auth/login", {
      method: "POST",
      body: { email: "new@example.com", password: "secret" },
    })
    expect(loginRes.status).toBe(200)
  })

  it("rejects a duplicate email with 409", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { name: "Dup", email: "admin@example.com", password: "secret" },
    })
    expect(res.status).toBe(409)
  })

  it("rejects a wrong password with 401", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: "member@example.com", password: "wrong" },
    })
    expect(res.status).toBe(401)
  })

  it("refreshes an access token", async () => {
    const { refreshToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { accessToken: string }
    expect(data.accessToken).toBeTruthy()
  })

  it("logs out", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/auth/logout", {
      method: "POST",
      token: accessToken,
    })
    expect(res.status).toBe(204)
  })
})

describe("users", () => {
  it("requires auth to list users (401)", async () => {
    const res = await api("/api/users")
    expect(res.status).toBe(401)
  })

  it("lists users without exposing passwords", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users", { token: accessToken })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<Record<string, unknown>>
    expect(list.length).toBe(2)
    for (const user of list) {
      expect(user).not.toHaveProperty("password")
      expect(user).toHaveProperty("id")
      expect(user).toHaveProperty("email")
      expect(user).toHaveProperty("role")
    }
  })

  it("forbids a member from changing a role (403)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/users/usr_admin/role", {
      method: "PATCH",
      token: accessToken,
      body: { role: "member" },
    })
    expect(res.status).toBe(403)
  })

  it("lets an admin change a role", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users/usr_member/role", {
      method: "PATCH",
      token: accessToken,
      body: { role: "admin" },
    })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as { role: string }
    expect(updated.role).toBe("admin")
  })

  it("forbids a member from deleting a user (403)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/users/usr_admin", {
      method: "DELETE",
      token: accessToken,
    })
    expect(res.status).toBe(403)
  })

  it("lets an admin delete a user", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users/usr_member", {
      method: "DELETE",
      token: accessToken,
    })
    expect(res.status).toBe(204)

    const listRes = await api("/api/users", { token: accessToken })
    const list = (await listRes.json()) as Array<{ id: string }>
    expect(list.some((user) => user.id === "usr_member")).toBe(false)
  })
})

describe("tasks", () => {
  it("requires auth to list tasks (401)", async () => {
    const res = await api("/api/tasks")
    expect(res.status).toBe(401)
  })

  it("lists seeded tasks", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks", { token: accessToken })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ title: string; status: string }>
    expect(list.length).toBe(150)
    expect(list.map((task) => task.title)).toContain(
      "Author the OpenAPI contract"
    )
  })

  it("filters, sorts, and paginates tasks via query params", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const filtered = await api("/api/tasks?q=author&_start=0&_end=10", {
      token: accessToken,
    })
    expect(filtered.status).toBe(200)
    const filteredList = (await filtered.json()) as Array<{ title: string }>
    expect(filteredList).toHaveLength(1)
    expect(filteredList[0]?.title).toBe("Author the OpenAPI contract")
    expect(filtered.headers.get("x-total-count")).toBe("1")

    const page = await api(
      "/api/tasks?_start=0&_end=5&_sort=title&_order=asc",
      { token: accessToken }
    )
    expect(page.status).toBe(200)
    const pageList = (await page.json()) as Array<{ title: string }>
    expect(pageList).toHaveLength(5)
    expect(page.headers.get("x-total-count")).toBe("150")

    const sorted = [...pageList.map((task) => task.title)].sort((a, b) =>
      a.localeCompare(b)
    )
    expect(pageList.map((task) => task.title)).toEqual(sorted)
  })

  it("filters by status, priority, assignee, and unassigned", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const byStatus = await api("/api/tasks?status=done", { token: accessToken })
    const statusList = (await byStatus.json()) as Array<{ status: string }>
    expect(statusList.length).toBe(38)
    expect(byStatus.headers.get("x-total-count")).toBe("38")
    for (const task of statusList) expect(task.status).toBe("done")

    const byPriority = await api("/api/tasks?priority=high", {
      token: accessToken,
    })
    const priorityList = (await byPriority.json()) as Array<{
      priority: string
    }>
    for (const task of priorityList) expect(task.priority).toBe("high")

    const byAssignee = await api("/api/tasks?assigneeId=usr_admin", {
      token: accessToken,
    })
    const assigneeList = (await byAssignee.json()) as Array<{
      assigneeId: string | null
    }>
    expect(assigneeList.length).toBeGreaterThan(0)
    for (const task of assigneeList) expect(task.assigneeId).toBe("usr_admin")

    const unassigned = await api("/api/tasks?assigneeId=unassigned", {
      token: accessToken,
    })
    const unassignedList = (await unassigned.json()) as Array<{
      assigneeId: string | null
    }>
    expect(unassignedList.length).toBeGreaterThan(0)
    for (const task of unassignedList) expect(task.assigneeId).toBeNull()
  })

  it("filters by repeated status values with OR semantics", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const res = await api("/api/tasks?status=todo&status=in-progress", {
      token: accessToken,
    })
    expect(res.status).toBe(200)

    const list = (await res.json()) as Array<{ status: string }>
    // todo 37 + in-progress 38 from the deterministic seed.
    expect(res.headers.get("x-total-count")).toBe("75")
    expect(list).toHaveLength(75)
    expect(new Set(list.map((task) => task.status))).toEqual(
      new Set(["todo", "in-progress"])
    )
  })

  it("rejects an invalid status value with 400", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    for (const path of [
      "/api/tasks?status=archived",
      "/api/tasks?status=todo&status=archived",
    ]) {
      const res = await api(path, { token: accessToken })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe("invalid_request")
    }
  })

  it("combines repeated status values with another filter using AND", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const res = await api(
      "/api/tasks?status=todo&status=in-progress&priority=medium",
      { token: accessToken }
    )
    expect(res.status).toBe(200)

    const list = (await res.json()) as Array<{
      status: string
      priority: string
    }>
    // Every in-progress task in the seed is medium priority; todo is low.
    expect(res.headers.get("x-total-count")).toBe("38")
    expect(list).toHaveLength(38)
    for (const task of list) {
      expect(["todo", "in-progress"]).toContain(task.status)
      expect(task.priority).toBe("medium")
    }
  })

  it("combines filters with AND", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks?status=done&priority=high", {
      token: accessToken,
    })
    const list = (await res.json()) as Array<{
      status: string
      priority: string
    }>
    expect(list.length).toBeGreaterThan(0)
    for (const task of list) {
      expect(task.status).toBe("done")
      expect(task.priority).toBe("high")
    }
  })

  it("filters by an inclusive due-date range and excludes null due dates", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const exact = await api(
      "/api/tasks?dueDate_gte=2026-01-05T00:00:00.000Z&dueDate_lte=2026-01-05T23:59:59.999Z",
      { token: accessToken }
    )
    const exactList = (await exact.json()) as Array<{ dueDate: string | null }>
    expect(exactList).toHaveLength(1)
    expect(exactList[0]?.dueDate).toBe("2026-01-05T12:00:00.000Z")

    const range = await api(
      "/api/tasks?dueDate_gte=2026-01-05T00:00:00.000Z&dueDate_lte=2026-01-10T23:59:59.999Z",
      { token: accessToken }
    )
    const rangeList = (await range.json()) as Array<{ dueDate: string | null }>
    expect(rangeList.length).toBeGreaterThan(0)
    for (const task of rangeList) {
      expect(task.dueDate).not.toBeNull()
      expect(task.dueDate! >= "2026-01-05T00:00:00.000Z").toBe(true)
      expect(task.dueDate! <= "2026-01-10T23:59:59.999Z").toBe(true)
    }
  })

  it("rejects date-only due-date bounds", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    for (const query of ["dueDate_gte=2026-01-05", "dueDate_lte=2026-01-05"]) {
      const res = await api(`/api/tasks?${query}`, { token: accessToken })
      expect(res.status).toBe(400)
    }
  })

  it("filters by datetime bounds as instants", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const inclusive = await api(
      "/api/tasks?dueDate_gte=2026-01-05T00:00:00.000Z&dueDate_lte=2026-01-05T12:00:00.000Z",
      { token: accessToken }
    )
    expect(inclusive.status).toBe(200)
    const included = (await inclusive.json()) as Array<{ dueDate: string }>
    expect(included.map((task) => task.dueDate)).toContain(
      "2026-01-05T12:00:00.000Z"
    )

    const exclusive = await api(
      "/api/tasks?dueDate_gte=2026-01-05T00:00:00.000Z&dueDate_lte=2026-01-05T11:59:59.999Z",
      { token: accessToken }
    )
    expect(exclusive.status).toBe(200)
    const excluded = (await exclusive.json()) as Array<{ dueDate: string }>
    expect(excluded.map((task) => task.dueDate)).not.toContain(
      "2026-01-05T12:00:00.000Z"
    )
  })

  it("normalizes legacy date-only records to local midnight on read", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    await tasks.create({
      id: "tsk_legacy_read",
      title: "Legacy due-date record",
      description: null,
      status: "todo",
      priority: null,
      assigneeId: null,
      dueDate: "2026-02-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })

    const res = await api("/api/tasks?q=legacy+due-date+record", {
      token: accessToken,
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ dueDate: string | null }>
    expect(list).toHaveLength(1)
    expect(list[0]?.dueDate).toBe("2026-02-01T00:00:00.000Z")
  })

  it("sorts due dates as instants, including legacy date-only values", async () => {
    process.env.TZ = "Asia/Ho_Chi_Minh"
    const { accessToken } = await login("admin@example.com", "adminpass")
    // In +07:00, legacy 2026-01-05 is 2026-01-04T17:00Z, before the instant.
    await tasks.create({
      id: "tsk_sort_legacy",
      title: "Sort due legacy",
      description: null,
      status: "todo",
      priority: null,
      assigneeId: null,
      dueDate: "2026-01-05",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
    await tasks.create({
      id: "tsk_sort_instant",
      title: "Sort due instant",
      description: null,
      status: "todo",
      priority: null,
      assigneeId: null,
      dueDate: "2026-01-04T20:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })

    const res = await api("/api/tasks?q=sort+due&_sort=dueDate&_order=asc", {
      token: accessToken,
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{
      id: string
      dueDate: string | null
    }>
    expect(list.map((task) => task.id)).toEqual([
      "tsk_sort_legacy",
      "tsk_sort_instant",
    ])
    expect(list[0]?.dueDate).toBe("2026-01-04T17:00:00.000Z")
  })

  it("requires auth to bulk update (401)", async () => {
    const res = await api("/api/tasks/bulk", {
      method: "PATCH",
      body: { ids: ["tsk_001"], status: "done" },
    })
    expect(res.status).toBe(401)
  })

  it("rejects a bulk update without any field (400)", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001"] },
    })
    expect(res.status).toBe(400)
  })

  it("bulk-updates tasks and reports missing ids as failed", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001", "tsk_002", "missing"], status: "done" },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as {
      updated: number
      failed: { id: string; reason: string }[]
    }
    expect(result.updated).toBe(2)
    expect(result.failed).toEqual([{ id: "missing", reason: "not_found" }])
  })

  it("lets a member bulk-update only their own tasks", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001", "tsk_002"], status: "blocked" },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as {
      updated: number
      failed: { id: string; reason: string }[]
    }
    expect(result.updated).toBe(1)
    expect(result.failed).toEqual([{ id: "tsk_001", reason: "forbidden" }])
  })

  it("clears priority and assignee with null in a bulk update", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001"], priority: null, assigneeId: null },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as { updated: number }
    expect(result.updated).toBe(1)

    const after = await api("/api/tasks?q=author", { token: accessToken })
    const list = (await after.json()) as Array<{
      id: string
      priority: string | null
      assigneeId: string | null
    }>
    const task = list.find((item) => item.id === "tsk_001")
    expect(task?.priority).toBeNull()
    expect(task?.assigneeId).toBeNull()
  })

  it("sets and clears dueDate in a bulk update", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const set = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001"], dueDate: "2026-06-01T12:00:00.000Z" },
    })
    expect(set.status).toBe(200)

    const afterSet = await api("/api/tasks?q=author", { token: accessToken })
    const setList = (await afterSet.json()) as Array<{
      id: string
      dueDate: string | null
    }>
    expect(setList.find((item) => item.id === "tsk_001")?.dueDate).toBe(
      "2026-06-01T12:00:00.000Z"
    )

    const clear = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001"], dueDate: null },
    })
    expect(clear.status).toBe(200)

    const afterClear = await api("/api/tasks?q=author", { token: accessToken })
    const clearList = (await afterClear.json()) as Array<{
      id: string
      dueDate: string | null
    }>
    expect(clearList.find((item) => item.id === "tsk_001")?.dueDate).toBeNull()
  })

  it("rejects a date-only dueDate in a bulk update", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks/bulk", {
      method: "PATCH",
      token: accessToken,
      body: { ids: ["tsk_001"], dueDate: "2026-06-01" },
    })
    expect(res.status).toBe(400)
  })

  it("creates a task assigned to the creator", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks", {
      method: "POST",
      token: accessToken,
      body: { title: "Write smoke tests" },
    })
    expect(res.status).toBe(201)
    const task = (await res.json()) as {
      id: string
      title: string
      assigneeId: string
      status: string
    }
    expect(task.title).toBe("Write smoke tests")
    expect(task.assigneeId).toBe("usr_member")
    expect(task.status).toBe("todo")
  })

  it("creates an unassigned task when assigneeId is null", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks", {
      method: "POST",
      token: accessToken,
      body: { title: "Unassigned task", assigneeId: null },
    })
    expect(res.status).toBe(201)
    const task = (await res.json()) as { assigneeId: string | null }
    expect(task.assigneeId).toBeNull()
  })

  it("rejects a date-only dueDate on create", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks", {
      method: "POST",
      token: accessToken,
      body: { title: "Date-only due date", dueDate: "2026-06-01" },
    })
    expect(res.status).toBe(400)
  })

  it("stores a created task's dueDate as a UTC instant", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const instant = await api("/api/tasks", {
      method: "POST",
      token: accessToken,
      body: { title: "Instant due date", dueDate: "2026-06-01T09:30:00+07:00" },
    })
    expect(instant.status).toBe(201)
    const instantTask = (await instant.json()) as { dueDate: string | null }
    expect(instantTask.dueDate).toBe("2026-06-01T02:30:00.000Z")
  })

  it("rejects an invalid dueDate on create", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks", {
      method: "POST",
      token: accessToken,
      body: { title: "Bad due date", dueDate: "not-a-date" },
    })
    expect(res.status).toBe(400)
  })

  it("rejects a date-only dueDate on update", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks/tsk_002", {
      method: "PATCH",
      token: accessToken,
      body: { dueDate: "2026-06-01" },
    })
    expect(res.status).toBe(400)
  })

  it("stores an updated dueDate as a UTC instant and clears it with null", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const updated = await api("/api/tasks/tsk_002", {
      method: "PATCH",
      token: accessToken,
      body: { dueDate: "2026-06-01T12:00:00.000Z" },
    })
    expect(updated.status).toBe(200)
    expect(((await updated.json()) as { dueDate: string | null }).dueDate).toBe(
      "2026-06-01T12:00:00.000Z"
    )

    const cleared = await api("/api/tasks/tsk_002", {
      method: "PATCH",
      token: accessToken,
      body: { dueDate: null },
    })
    expect(cleared.status).toBe(200)
    expect(((await cleared.json()) as { dueDate: string | null }).dueDate).toBe(
      null
    )
  })

  it("lets a member update their own task", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks/tsk_002", {
      method: "PATCH",
      token: accessToken,
      body: { status: "done" },
    })
    expect(res.status).toBe(200)
    const task = (await res.json()) as { status: string }
    expect(task.status).toBe("done")
  })

  it("lets a user clear a task's priority to null (nullable field)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks/tsk_002", {
      method: "PATCH",
      token: accessToken,
      body: { priority: null },
    })
    expect(res.status).toBe(200)
    const task = (await res.json()) as { priority: string | null }
    expect(task.priority).toBeNull()
  })

  it("forbids a member from updating another user's task (403)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks/tsk_001", {
      method: "PATCH",
      token: accessToken,
      body: { title: "Hijack" },
    })
    expect(res.status).toBe(403)
  })

  it("lets an admin update any task", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks/tsk_002", {
      method: "PATCH",
      token: accessToken,
      body: { title: "Renamed by admin" },
    })
    expect(res.status).toBe(200)
    const task = (await res.json()) as { title: string }
    expect(task.title).toBe("Renamed by admin")
  })

  it("forbids a member from deleting another user's task (403)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/tasks/tsk_001", {
      method: "DELETE",
      token: accessToken,
    })
    expect(res.status).toBe(403)
  })

  it("lets an admin delete any task", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/tasks/tsk_001", {
      method: "DELETE",
      token: accessToken,
    })
    expect(res.status).toBe(204)
  })
})

describe("password", () => {
  it("requires auth (401)", async () => {
    const res = await api("/api/password", {
      method: "PUT",
      body: { currentPassword: "x", newPassword: "y" },
    })
    expect(res.status).toBe(401)
  })

  it("updates the password and reflects it on next login", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/password", {
      method: "PUT",
      token: accessToken,
      body: { currentPassword: "memberpass", newPassword: "newpass" },
    })
    expect(res.status).toBe(204)

    const oldLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "member@example.com", password: "memberpass" },
    })
    expect(oldLogin.status).toBe(401)

    const newLogin = await api("/api/auth/login", {
      method: "POST",
      body: { email: "member@example.com", password: "newpass" },
    })
    expect(newLogin.status).toBe(200)
  })

  it("rejects a wrong current password (401)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/password", {
      method: "PUT",
      token: accessToken,
      body: { currentPassword: "wrong", newPassword: "newpass" },
    })
    expect(res.status).toBe(401)
  })
})
