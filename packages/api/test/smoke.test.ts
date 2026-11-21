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
import { handlers, resetDb, roles, tasks, users } from "../src/index"

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
      user: {
        id: string
        email: string
        roleId: string
        role: { id: string; title: string; status: string }
      }
    }
    expect(registered.accessToken).toBeTruthy()
    expect(registered.refreshToken).toBeTruthy()
    expect(registered.user.roleId).toBe("rol_member")
    expect(registered.user.role).toEqual({
      id: "rol_member",
      title: "Member",
      status: "active",
    })
    expect(registered.user.email).toBe("new@example.com")

    const loginRes = await api("/api/auth/login", {
      method: "POST",
      body: { email: "new@example.com", password: "secret" },
    })
    expect(loginRes.status).toBe(200)
    const loggedIn = (await loginRes.json()) as {
      user: { roleId: string; role: { id: string; title: string } }
    }
    expect(loggedIn.user.roleId).toBe("rol_member")
    expect(loggedIn.user.role).toMatchObject({
      id: "rol_member",
      title: "Member",
    })
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
    const data = (await res.json()) as {
      accessToken: string
      refreshToken: string
      user: { roleId: string; role: { id: string; title: string } }
    }
    expect(data.accessToken).toBeTruthy()
    expect(data.refreshToken).toBeTruthy()
    expect(data.user.roleId).toBe("rol_member")
    expect(data.user.role).toMatchObject({
      id: "rol_member",
      title: "Member",
    })
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

  it("lists users with a role id and embedded summary, without passwords", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users", { token: accessToken })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{
      id: string
      email: string
      roleId: string
      role: { id: string; title: string; status: string }
      password?: unknown
    }>
    expect(list.length).toBe(2)
    const admin = list.find((user) => user.id === "usr_admin")
    expect(admin).toMatchObject({
      roleId: "rol_admin",
      role: { id: "rol_admin", title: "Administrator", status: "active" },
    })
    const member = list.find((user) => user.id === "usr_member")
    expect(member).toMatchObject({
      roleId: "rol_member",
      role: { id: "rol_member", title: "Member", status: "active" },
    })
    for (const user of list) {
      expect(user).not.toHaveProperty("password")
      expect(typeof user.roleId).toBe("string")
      expect(typeof user.role.id).toBe("string")
      expect(typeof user.role.title).toBe("string")
      expect(["active", "inactive"]).toContain(user.role.status)
    }
  })

  it("keeps describing an inactive Role a User already holds", async () => {
    await users.create({
      id: "usr_inactive_holder",
      name: "Inactive Holder",
      email: "inactive@example.com",
      roleId: "rol_demo_02",
      password: "inactivepass",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users?roleId=rol_demo_02", {
      token: accessToken,
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{
      id: string
      roleId: string
      role: { id: string; title: string; status: string }
    }>
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: "usr_inactive_holder",
      roleId: "rol_demo_02",
      role: {
        id: "rol_demo_02",
        title: "Demo Role 02",
        status: "inactive",
      },
    })
  })

  it("filters users by role identity", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const members = await api("/api/users?roleId=rol_member", {
      token: accessToken,
    })
    expect(members.status).toBe(200)
    expect(members.headers.get("x-total-count")).toBe("1")
    const memberList = (await members.json()) as Array<{ id: string }>
    expect(memberList.map((user) => user.id)).toEqual(["usr_member"])

    const admins = await api("/api/users?roleId=rol_admin", {
      token: accessToken,
    })
    expect(admins.headers.get("x-total-count")).toBe("1")
    const adminList = (await admins.json()) as Array<{ id: string }>
    expect(adminList.map((user) => user.id)).toEqual(["usr_admin"])
  })

  it("sorts users by role identity", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users?_sort=roleId&_order=asc", {
      token: accessToken,
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ roleId: string }>
    expect(list.map((user) => user.roleId)).toEqual(["rol_admin", "rol_member"])
  })

  it("forbids a member from changing a role (403)", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/users/usr_admin/role", {
      method: "PATCH",
      token: accessToken,
      body: { roleId: "rol_member" },
    })
    expect(res.status).toBe(403)
  })

  it("lets an admin change a user's role by identity", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users/usr_member/role", {
      method: "PATCH",
      token: accessToken,
      body: { roleId: "rol_admin" },
    })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as {
      roleId: string
      role: { id: string; title: string; status: string }
    }
    expect(updated.roleId).toBe("rol_admin")
    expect(updated.role).toEqual({
      id: "rol_admin",
      title: "Administrator",
      status: "active",
    })
  })

  it("rejects an unknown role identity with 400", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users/usr_member/role", {
      method: "PATCH",
      token: accessToken,
      body: { roleId: "rol_missing" },
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe(
      "invalid_request"
    )
  })

  it("rejects assigning an inactive role with 400", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    // Demo Role 02 is seeded inactive.
    const res = await api("/api/users/usr_member/role", {
      method: "PATCH",
      token: accessToken,
      body: { roleId: "rol_demo_02" },
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe(
      "invalid_request"
    )
  })

  it("requires a role identity on the update request", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users/usr_member/role", {
      method: "PATCH",
      token: accessToken,
      body: { role: "admin" },
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when changing the role of a missing user", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/users/usr_missing/role", {
      method: "PATCH",
      token: accessToken,
      body: { roleId: "rol_admin" },
    })
    expect(res.status).toBe(404)
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

  it("filters by repeated priority values with OR semantics", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const res = await api("/api/tasks?priority=low&priority=high", {
      token: accessToken,
    })
    expect(res.status).toBe(200)

    const list = (await res.json()) as Array<{ priority: string }>
    // low 37 + high 38 from the deterministic seed.
    expect(res.headers.get("x-total-count")).toBe("75")
    expect(list).toHaveLength(75)
    expect(new Set(list.map((task) => task.priority))).toEqual(
      new Set(["low", "high"])
    )
  })

  it("filters by repeated assignees, treating unassigned as a missing assignee", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const withUnassigned = await api(
      "/api/tasks?assigneeId=usr_admin&assigneeId=unassigned",
      { token: accessToken }
    )
    expect(withUnassigned.status).toBe(200)
    const mixed = (await withUnassigned.json()) as Array<{
      assigneeId: string | null
    }>
    // usr_admin 60 + unassigned 30, no overlap.
    expect(withUnassigned.headers.get("x-total-count")).toBe("90")
    expect(mixed).toHaveLength(90)
    for (const task of mixed) {
      expect(task.assigneeId === null || task.assigneeId === "usr_admin").toBe(
        true
      )
    }

    const bothUsers = await api(
      "/api/tasks?assigneeId=usr_admin&assigneeId=usr_member",
      { token: accessToken }
    )
    expect(bothUsers.status).toBe(200)
    expect(bothUsers.headers.get("x-total-count")).toBe("120")
  })

  it("ignores an empty status parameter", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const res = await api("/api/tasks?status=", { token: accessToken })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-total-count")).toBe("150")
    const list = (await res.json()) as Array<{ status: string }>
    expect(list).toHaveLength(150)
  })

  it("rejects an unknown assignee id with 400", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    for (const path of [
      "/api/tasks?assigneeId=usr_missing",
      "/api/tasks?assigneeId=usr_admin&assigneeId=usr_missing",
    ]) {
      const res = await api(path, { token: accessToken })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe("invalid_request")
    }
  })

  it("rejects an invalid priority value with 400", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    for (const path of [
      "/api/tasks?priority=urgent",
      "/api/tasks?priority=low&priority=urgent",
    ]) {
      const res = await api(path, { token: accessToken })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe("invalid_request")
    }
  })

  it("combines repeated priority values with another filter using AND", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const res = await api("/api/tasks?priority=low&priority=high&status=todo", {
      token: accessToken,
    })
    expect(res.status).toBe(200)

    const list = (await res.json()) as Array<{
      status: string
      priority: string
    }>
    // In the seed, every todo task is low priority and every high-priority
    // task is not todo, so only the 37 low/todo tasks match.
    expect(res.headers.get("x-total-count")).toBe("37")
    expect(list).toHaveLength(37)
    for (const task of list) {
      expect(task.status).toBe("todo")
      expect(task.priority).toBe("low")
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

interface RoleRow {
  id: string
  title: string
  description: string | null
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string
}

describe("roles", () => {
  it("requires auth to list roles (401)", async () => {
    const res = await api("/api/roles")
    expect(res.status).toBe(401)
  })

  it("seeds exactly 60 roles, including inactive ones, for an authenticated caller", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/roles", { token: accessToken })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-total-count")).toBe("60")

    const list = (await res.json()) as RoleRow[]
    expect(list).toHaveLength(60)
    expect(list.map((role) => role.id)).toEqual(
      expect.arrayContaining(["rol_admin", "rol_member"])
    )
    expect(
      list
        .filter((role) => role.id === "rol_admin" || role.id === "rol_member")
        .map((role) => role.title)
        .sort()
    ).toEqual(["Administrator", "Member"])
    // No implicit status filter: inactive Roles are part of the default list.
    expect(new Set(list.map((role) => role.status))).toEqual(
      new Set(["active", "inactive"])
    )
    for (const role of list) {
      expect(role).toHaveProperty("description")
      expect(role).toHaveProperty("createdAt")
      expect(role).toHaveProperty("updatedAt")
    }
  })

  it("restores the 60-role seed when the store resets", async () => {
    await roles.create({
      id: "rol_extra",
      title: "Extra Role",
      description: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
    expect(roles.all()).toHaveLength(61)

    await resetDb()
    expect(roles.all()).toHaveLength(60)
  })

  it("paginates with _start/_end and reports the pre-pagination total", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")

    const first = await api("/api/roles?_start=0&_end=30", {
      token: accessToken,
    })
    expect(first.status).toBe(200)
    expect(first.headers.get("x-total-count")).toBe("60")
    const firstPage = (await first.json()) as RoleRow[]
    expect(firstPage).toHaveLength(30)

    const second = await api("/api/roles?_start=30&_end=60", {
      token: accessToken,
    })
    expect(second.status).toBe(200)
    expect(second.headers.get("x-total-count")).toBe("60")
    const secondPage = (await second.json()) as RoleRow[]
    expect(secondPage).toHaveLength(30)
    expect(secondPage.map((role) => role.id)).not.toEqual(
      expect.arrayContaining(firstPage.map((role) => role.id))
    )
  })

  it("sorts by title ascending and descending", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const asc = await api("/api/roles?_sort=title&_order=asc", {
      token: accessToken,
    })
    expect(asc.status).toBe(200)
    const ascTitles = ((await asc.json()) as RoleRow[]).map(
      (role) => role.title
    )
    expect(ascTitles).toHaveLength(60)
    expect(ascTitles).toEqual([...ascTitles].sort((a, b) => a.localeCompare(b)))
    expect(ascTitles[0]).toBe("Administrator")
    expect(ascTitles.at(-1)).toBe("Member")

    const desc = await api("/api/roles?_sort=title&_order=desc", {
      token: accessToken,
    })
    expect(desc.status).toBe(200)
    const descTitles = ((await desc.json()) as RoleRow[]).map(
      (role) => role.title
    )
    expect(descTitles).toEqual([...ascTitles].reverse())
    expect(descTitles[0]).toBe("Member")
    expect(descTitles.at(-1)).toBe("Administrator")
  })

  it("sorts by status ascending and descending", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const asc = await api("/api/roles?_sort=status&_order=asc", {
      token: accessToken,
    })
    expect(asc.status).toBe(200)
    const ascList = (await asc.json()) as RoleRow[]
    expect(ascList).toHaveLength(60)
    const firstInactive = ascList.findIndex(
      (role) => role.status === "inactive"
    )
    expect(
      ascList.slice(0, firstInactive).every((r) => r.status === "active")
    ).toBe(true)
    expect(
      ascList.slice(firstInactive).every((r) => r.status === "inactive")
    ).toBe(true)

    const desc = await api("/api/roles?_sort=status&_order=desc", {
      token: accessToken,
    })
    const descList = (await desc.json()) as RoleRow[]
    expect(descList[0]?.status).toBe("inactive")
    expect(descList.at(-1)?.status).toBe("active")
  })

  it("sorts by createdAt and updatedAt as instants", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const created = await api("/api/roles?_sort=createdAt&_order=asc", {
      token: accessToken,
    })
    const createdList = (await created.json()) as RoleRow[]
    expect(createdList[0]?.id).toBe("rol_admin")
    expect(createdList[1]?.id).toBe("rol_member")
    for (let i = 1; i < createdList.length; i++) {
      expect(
        Date.parse(createdList[i]!.createdAt) >=
          Date.parse(createdList[i - 1]!.createdAt)
      ).toBe(true)
    }

    const updatedDesc = await api("/api/roles?_sort=updatedAt&_order=desc", {
      token: accessToken,
    })
    const updatedList = (await updatedDesc.json()) as RoleRow[]
    expect(updatedList[0]?.id).toBe("rol_member")
    expect(updatedList[1]?.id).toBe("rol_admin")
    for (let i = 1; i < updatedList.length; i++) {
      expect(
        Date.parse(updatedList[i]!.updatedAt) <=
          Date.parse(updatedList[i - 1]!.updatedAt)
      ).toBe(true)
    }
  })

  it("falls back to a safe default for an unknown sort field", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const fallback = await api("/api/roles?_sort=unknown&_order=asc", {
      token: accessToken,
    })
    expect(fallback.status).toBe(200)
    const fallbackTitles = ((await fallback.json()) as RoleRow[]).map(
      (role) => role.title
    )
    expect(fallbackTitles).toEqual(
      [...fallbackTitles].sort((a, b) => a.localeCompare(b))
    )
  })

  it("filters by a case-insensitive title contains match", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const lower = await api("/api/roles?title_like=demo", {
      token: accessToken,
    })
    expect(lower.status).toBe(200)
    expect(lower.headers.get("x-total-count")).toBe("58")
    const lowerList = (await lower.json()) as RoleRow[]
    expect(lowerList).toHaveLength(58)
    for (const role of lowerList) {
      expect(role.title.toLowerCase()).toContain("demo")
    }

    const upper = await api("/api/roles?title_like=DEMO%20ROLE%200", {
      token: accessToken,
    })
    expect(upper.status).toBe(200)
    expect(upper.headers.get("x-total-count")).toBe("9")

    const none = await api("/api/roles?title_like=no-such-role", {
      token: accessToken,
    })
    expect(none.status).toBe(200)
    expect(none.headers.get("x-total-count")).toBe("0")
  })

  it("filters by a case-insensitive description contains match", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const res = await api("/api/roles?description_like=DESCRIPTION", {
      token: accessToken,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-total-count")).toBe("43")
    const list = (await res.json()) as RoleRow[]
    expect(list).toHaveLength(43)
    for (const role of list) {
      expect(role.description?.toLowerCase()).toContain("description")
    }
  })

  it("filters by an inclusive createdAt range", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const exact = await api(
      "/api/roles?createdAt_gte=2026-01-10T12:00:00.000Z&createdAt_lte=2026-01-10T12:00:00.000Z",
      { token: accessToken }
    )
    expect(exact.status).toBe(200)
    const exactList = (await exact.json()) as RoleRow[]
    expect(exactList.map((role) => role.id)).toEqual(["rol_demo_10"])

    const range = await api(
      "/api/roles?createdAt_gte=2026-01-10T12:00:00.000Z&createdAt_lte=2026-01-20T12:00:00.000Z",
      { token: accessToken }
    )
    expect(range.status).toBe(200)
    expect(range.headers.get("x-total-count")).toBe("11")
    const rangeList = (await range.json()) as RoleRow[]
    expect(rangeList).toHaveLength(11)
    for (const role of rangeList) {
      expect(Date.parse(role.createdAt)).toBeGreaterThanOrEqual(
        Date.parse("2026-01-10T12:00:00.000Z")
      )
      expect(Date.parse(role.createdAt)).toBeLessThanOrEqual(
        Date.parse("2026-01-20T12:00:00.000Z")
      )
    }
  })

  it("filters by an inclusive updatedAt range", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const exact = await api(
      "/api/roles?updatedAt_gte=2026-03-10T09:30:00.000Z&updatedAt_lte=2026-03-10T09:30:00.000Z",
      { token: accessToken }
    )
    expect(exact.status).toBe(200)
    const exactList = (await exact.json()) as RoleRow[]
    expect(exactList.map((role) => role.id)).toEqual(["rol_demo_10"])

    const range = await api(
      "/api/roles?updatedAt_gte=2026-03-10T09:30:00.000Z&updatedAt_lte=2026-03-20T09:30:00.000Z",
      { token: accessToken }
    )
    expect(range.status).toBe(200)
    expect(range.headers.get("x-total-count")).toBe("11")
  })

  it("filters by status", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const active = await api("/api/roles?status=active", {
      token: accessToken,
    })
    expect(active.status).toBe(200)
    expect(active.headers.get("x-total-count")).toBe("31")
    const activeList = (await active.json()) as RoleRow[]
    for (const role of activeList) expect(role.status).toBe("active")

    const inactive = await api("/api/roles?status=inactive", {
      token: accessToken,
    })
    expect(inactive.status).toBe(200)
    expect(inactive.headers.get("x-total-count")).toBe("29")
    const inactiveList = (await inactive.json()) as RoleRow[]
    for (const role of inactiveList) expect(role.status).toBe("inactive")

    // A repeated parameter matches any of the listed statuses (OR).
    const either = await api("/api/roles?status=active&status=inactive", {
      token: accessToken,
    })
    expect(either.status).toBe(200)
    expect(either.headers.get("x-total-count")).toBe("60")
  })

  it("ignores an empty status parameter", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/roles?status=", { token: accessToken })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-total-count")).toBe("60")
  })

  it("combines filters with AND semantics", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    const titleAndStatus = await api(
      "/api/roles?title_like=demo&status=inactive",
      { token: accessToken }
    )
    expect(titleAndStatus.status).toBe(200)
    expect(titleAndStatus.headers.get("x-total-count")).toBe("29")

    const dateAndStatus = await api(
      "/api/roles?createdAt_gte=2026-01-10T12:00:00.000Z&createdAt_lte=2026-01-20T12:00:00.000Z&status=active",
      { token: accessToken }
    )
    expect(dateAndStatus.status).toBe(200)
    expect(dateAndStatus.headers.get("x-total-count")).toBe("5")

    const threeFilters = await api(
      "/api/roles?title_like=demo%20role%200&description_like=description&status=inactive",
      { token: accessToken }
    )
    expect(threeFilters.status).toBe(200)
    expect(threeFilters.headers.get("x-total-count")).toBe("4")
  })

  it("rejects an invalid status or date bound with 400", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")

    for (const path of [
      "/api/roles?status=archived",
      "/api/roles?status=active&status=archived",
      "/api/roles?createdAt_gte=not-a-date",
      "/api/roles?createdAt_lte=2026-01-05",
      "/api/roles?updatedAt_gte=not-a-date",
      "/api/roles?updatedAt_lte=2026-01-05",
    ]) {
      const res = await api(path, { token: accessToken })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe("invalid_request")
    }
  })

  it("returns a role by id for any authenticated caller", async () => {
    const member = await login("member@example.com", "memberpass")
    const res = await api("/api/roles/rol_admin", {
      token: member.accessToken,
    })
    expect(res.status).toBe(200)
    const role = (await res.json()) as RoleRow
    expect(role).toMatchObject({
      id: "rol_admin",
      title: "Administrator",
      status: "active",
    })
    expect(typeof role.createdAt).toBe("string")
    expect(typeof role.updatedAt).toBe("string")
  })

  it("requires auth to read a role detail (401)", async () => {
    const res = await api("/api/roles/rol_admin")
    expect(res.status).toBe(401)
  })

  it("returns 404 for an unknown role", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const res = await api("/api/roles/rol_missing", { token: accessToken })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("not_found")
  })
})

interface RoleWrite {
  method: string
  path: string
  body?: unknown
}

const roleWrites: RoleWrite[] = [
  { method: "POST", path: "/api/roles", body: { title: "New Role" } },
  {
    method: "PATCH",
    path: "/api/roles/rol_demo_01",
    body: { description: "Changed" },
  },
  {
    method: "PATCH",
    path: "/api/roles/bulk",
    body: { ids: ["rol_demo_01"], status: "active" },
  },
  {
    method: "POST",
    path: "/api/roles/bulk-delete",
    body: { ids: ["rol_demo_01"] },
  },
  { method: "DELETE", path: "/api/roles/rol_demo_01" },
]

describe("role writes", () => {
  it("rejects anonymous writes with 401", async () => {
    for (const write of roleWrites) {
      const res = await api(write.path, {
        method: write.method,
        body: write.body,
      })
      expect([write.method, write.path, res.status]).toEqual([
        write.method,
        write.path,
        401,
      ])
    }
  })

  it("rejects member writes with 403", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    for (const write of roleWrites) {
      const res = await api(write.path, {
        method: write.method,
        token: accessToken,
        body: write.body,
      })
      expect([write.method, write.path, res.status]).toEqual([
        write.method,
        write.path,
        403,
      ])
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe("forbidden")
    }
    // The rejected writes left every seeded role untouched.
    expect(roles.all()).toHaveLength(60)
  })

  describe("create", () => {
    it("creates a role with a trimmed title, default active status, and server-managed fields", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const before = Date.now()

      const res = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "  Support Lead  " },
      })
      expect(res.status).toBe(201)
      const role = (await res.json()) as RoleRow
      expect(role.title).toBe("Support Lead")
      expect(role.description).toBeNull()
      expect(role.status).toBe("active")
      expect(role.id).toMatch(/^rol_[0-9a-f-]{36}$/)
      expect(role.createdAt).toBe(role.updatedAt)
      expect(Date.parse(role.createdAt)).toBeGreaterThanOrEqual(before)
      expect(Date.parse(role.createdAt)).toBeLessThanOrEqual(Date.now())

      const list = await api("/api/roles?title_like=support%20lead", {
        token: accessToken,
      })
      const rows = (await list.json()) as RoleRow[]
      expect(rows.map((row) => row.id)).toEqual([role.id])
    })

    it("trims the description and stores a blank description as null", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")

      const withText = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "Ops", description: "  Owns operations.  " },
      })
      expect(withText.status).toBe(201)
      expect(((await withText.json()) as RoleRow).description).toBe(
        "Owns operations."
      )

      const blank = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "Blank", description: "   " },
      })
      expect(blank.status).toBe(201)
      expect(((await blank.json()) as RoleRow).description).toBeNull()

      const explicitNull = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "Explicit Null", description: null },
      })
      expect(explicitNull.status).toBe(201)
      expect(((await explicitNull.json()) as RoleRow).description).toBeNull()
    })

    it("accepts an explicit inactive status", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "Retired", status: "inactive" },
      })
      expect(res.status).toBe(201)
      expect(((await res.json()) as RoleRow).status).toBe("inactive")
    })

    it("rejects blank, whitespace-only, non-string, and over-100 titles with 400", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      for (const title of ["", "   ", 42, "x".repeat(101)]) {
        const res = await api("/api/roles", {
          method: "POST",
          token: accessToken,
          body: { title },
        })
        expect(res.status).toBe(400)
        const body = (await res.json()) as { code: string }
        expect(body.code).toBe("invalid_request")
      }
    })

    it("accepts a title of exactly 100 characters after trimming", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: `  ${"x".repeat(100)}  ` },
      })
      expect(res.status).toBe(201)
      expect(((await res.json()) as RoleRow).title).toBe("x".repeat(100))
    })

    it("rejects an over-500 description but accepts exactly 500", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")

      const tooLong = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "Too Long", description: "d".repeat(501) },
      })
      expect(tooLong.status).toBe(400)

      const max = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "At Max", description: `  ${"d".repeat(500)}  ` },
      })
      expect(max.status).toBe(201)
      expect(((await max.json()) as RoleRow).description).toBe("d".repeat(500))
    })

    it("rejects an invalid status with 400", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: { title: "Bad Status", status: "archived" },
      })
      expect(res.status).toBe(400)
    })

    it("rejects a duplicate title case-insensitively after trimming with 409", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      for (const title of ["Administrator", "  administrator  "]) {
        const res = await api("/api/roles", {
          method: "POST",
          token: accessToken,
          body: { title },
        })
        expect(res.status).toBe(409)
        const body = (await res.json()) as { code: string }
        expect(body.code).toBe("duplicate_title")
      }
    })

    it("ignores client-supplied ids and timestamps on create", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles", {
        method: "POST",
        token: accessToken,
        body: {
          id: "rol_client",
          createdAt: "2000-01-01T00:00:00.000Z",
          updatedAt: "2000-01-01T00:00:00.000Z",
          title: "Client Fields",
        },
      })
      expect(res.status).toBe(201)
      const role = (await res.json()) as RoleRow
      expect(role.id).not.toBe("rol_client")
      expect(role.id).toMatch(/^rol_[0-9a-f-]{36}$/)
      expect(Date.parse(role.createdAt)).toBeGreaterThan(
        Date.parse("2020-01-01T00:00:00.000Z")
      )
      expect(role.updatedAt).toBe(role.createdAt)
    })
  })

  describe("update", () => {
    it("changes only supplied fields and refreshes updatedAt", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const beforeRes = await api("/api/roles/rol_demo_01", {
        token: accessToken,
      })
      const before = (await beforeRes.json()) as RoleRow
      expect(before.title).toBe("Demo Role 01")
      expect(before.status).toBe("active")

      const res = await api("/api/roles/rol_demo_01", {
        method: "PATCH",
        token: accessToken,
        body: { description: "  New description  " },
      })
      expect(res.status).toBe(200)
      const updated = (await res.json()) as RoleRow
      expect(updated.title).toBe(before.title)
      expect(updated.status).toBe(before.status)
      expect(updated.description).toBe("New description")
      expect(updated.createdAt).toBe(before.createdAt)
      expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
        Date.parse(before.updatedAt)
      )

      const stored = await api("/api/roles/rol_demo_01", {
        token: accessToken,
      })
      expect(((await stored.json()) as RoleRow).description).toBe(
        "New description"
      )
    })

    it("trims a new title and stores a blank description as null", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/rol_demo_02", {
        method: "PATCH",
        token: accessToken,
        body: { title: "  Renamed Role  ", description: "   " },
      })
      expect(res.status).toBe(200)
      const updated = (await res.json()) as RoleRow
      expect(updated.title).toBe("Renamed Role")
      expect(updated.description).toBeNull()
    })

    it("cannot change the id or createdAt", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const beforeRes = await api("/api/roles/rol_demo_03", {
        token: accessToken,
      })
      const before = (await beforeRes.json()) as RoleRow

      const res = await api("/api/roles/rol_demo_03", {
        method: "PATCH",
        token: accessToken,
        body: {
          id: "rol_hijacked",
          createdAt: "2000-01-01T00:00:00.000Z",
          description: "Id immutable",
        },
      })
      expect(res.status).toBe(200)
      const updated = (await res.json()) as RoleRow
      expect(updated.id).toBe("rol_demo_03")
      expect(updated.createdAt).toBe(before.createdAt)
    })

    it("returns 404 for a missing role", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/rol_missing", {
        method: "PATCH",
        token: accessToken,
        body: { description: "Nope" },
      })
      expect(res.status).toBe(404)
      expect(((await res.json()) as { code: string }).code).toBe("not_found")
    })

    it("rejects invalid title, description, and status values with 400", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      for (const body of [
        { title: "   " },
        { title: 42 },
        { title: "x".repeat(101) },
        { description: 42 },
        { description: "d".repeat(501) },
        { status: "archived" },
      ]) {
        const res = await api("/api/roles/rol_demo_04", {
          method: "PATCH",
          token: accessToken,
          body,
        })
        expect(res.status).toBe(400)
        expect(((await res.json()) as { code: string }).code).toBe(
          "invalid_request"
        )
      }
    })

    it("rejects a duplicate title case-insensitively but allows its own title", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")

      const own = await api("/api/roles/rol_demo_05", {
        method: "PATCH",
        token: accessToken,
        body: { title: "demo role 05" },
      })
      expect(own.status).toBe(200)

      const duplicate = await api("/api/roles/rol_demo_05", {
        method: "PATCH",
        token: accessToken,
        body: { title: "  ADMINISTRATOR  " },
      })
      expect(duplicate.status).toBe(409)
      expect(((await duplicate.json()) as { code: string }).code).toBe(
        "duplicate_title"
      )
    })

    it("edits a System Role's title and description but refuses to deactivate it", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")

      const edit = await api("/api/roles/rol_admin", {
        method: "PATCH",
        token: accessToken,
        body: {
          title: "Chief Administrator",
          description: "  Runs the place.  ",
          id: "rol_other",
        },
      })
      expect(edit.status).toBe(200)
      const edited = (await edit.json()) as RoleRow
      expect(edited.id).toBe("rol_admin")
      expect(edited.title).toBe("Chief Administrator")
      expect(edited.description).toBe("Runs the place.")
      expect(edited.status).toBe("active")

      const deactivate = await api("/api/roles/rol_admin", {
        method: "PATCH",
        token: accessToken,
        body: { status: "inactive" },
      })
      expect(deactivate.status).toBe(409)
      expect(((await deactivate.json()) as { code: string }).code).toBe(
        "system_role"
      )
    })
  })

  describe("delete", () => {
    it("deletes a demo role that no user holds", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")

      const res = await api("/api/roles/rol_demo_07", {
        method: "DELETE",
        token: accessToken,
      })
      expect(res.status).toBe(204)

      const gone = await api("/api/roles/rol_demo_07", { token: accessToken })
      expect(gone.status).toBe(404)
      expect(roles.all()).toHaveLength(59)
    })

    it("returns 404 for a missing role", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/rol_missing", {
        method: "DELETE",
        token: accessToken,
      })
      expect(res.status).toBe(404)
      expect(((await res.json()) as { code: string }).code).toBe("not_found")
    })

    it("refuses to delete a role held by a user", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      await users.create({
        id: "usr_holder",
        name: "Role Holder",
        email: "holder@example.com",
        roleId: "rol_demo_06",
        password: "holderpass",
        createdAt: "2026-01-01T00:00:00.000Z",
      })

      const res = await api("/api/roles/rol_demo_06", {
        method: "DELETE",
        token: accessToken,
      })
      expect(res.status).toBe(409)
      expect(((await res.json()) as { code: string }).code).toBe("referenced")
      expect(
        roles.findFirst((query) => query.where({ id: "rol_demo_06" }))
      ).toBeDefined()
    })

    it("refuses to delete a System Role", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      for (const id of ["rol_admin", "rol_member"]) {
        const res = await api(`/api/roles/${id}`, {
          method: "DELETE",
          token: accessToken,
        })
        expect(res.status).toBe(409)
        expect(((await res.json()) as { code: string }).code).toBe(
          "system_role"
        )
      }
      expect(roles.all()).toHaveLength(60)
    })
  })

  describe("bulk update", () => {
    it("updates only the supplied fields on each role and refreshes updatedAt", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const beforeRes = await api("/api/roles/rol_demo_01", {
        token: accessToken,
      })
      const before = (await beforeRes.json()) as RoleRow

      const res = await api("/api/roles/bulk", {
        method: "PATCH",
        token: accessToken,
        body: {
          ids: ["rol_demo_01", "rol_demo_02"],
          description: "  Bulk description  ",
          status: "inactive",
        },
      })
      expect(res.status).toBe(200)
      const result = (await res.json()) as {
        updated: number
        failed: { id: string; reason: string }[]
      }
      expect(result).toEqual({ updated: 2, failed: [] })

      const one = (await (
        await api("/api/roles/rol_demo_01", { token: accessToken })
      ).json()) as RoleRow
      expect(one.title).toBe(before.title)
      expect(one.description).toBe("Bulk description")
      expect(one.status).toBe("inactive")
      expect(one.createdAt).toBe(before.createdAt)
      expect(Date.parse(one.updatedAt)).toBeGreaterThan(
        Date.parse(before.updatedAt)
      )
    })

    it("clears a description with null without touching status", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const beforeRes = await api("/api/roles/rol_demo_03", {
        token: accessToken,
      })
      const before = (await beforeRes.json()) as RoleRow
      expect(before.description).not.toBeNull()

      const res = await api("/api/roles/bulk", {
        method: "PATCH",
        token: accessToken,
        body: { ids: ["rol_demo_03"], description: null },
      })
      expect(res.status).toBe(200)
      expect((await res.json()) as unknown).toEqual({
        updated: 1,
        failed: [],
      })

      const after = (await (
        await api("/api/roles/rol_demo_03", { token: accessToken })
      ).json()) as RoleRow
      expect(after.description).toBeNull()
      expect(after.status).toBe(before.status)
    })

    it("reports not_found and system_role failures per row", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/bulk", {
        method: "PATCH",
        token: accessToken,
        body: {
          ids: ["rol_demo_01", "rol_missing", "rol_admin"],
          status: "inactive",
        },
      })
      expect(res.status).toBe(200)
      expect((await res.json()) as unknown).toEqual({
        updated: 1,
        failed: [
          { id: "rol_missing", reason: "not_found" },
          { id: "rol_admin", reason: "system_role" },
        ],
      })

      const updated = (await (
        await api("/api/roles/rol_demo_01", { token: accessToken })
      ).json()) as RoleRow
      expect(updated.status).toBe("inactive")
      const system = (await (
        await api("/api/roles/rol_admin", { token: accessToken })
      ).json()) as RoleRow
      expect(system.status).toBe("active")
    })

    it("reports an over-length description as a per-row validation failure", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/bulk", {
        method: "PATCH",
        token: accessToken,
        body: {
          ids: ["rol_demo_01", "rol_missing"],
          description: "d".repeat(501),
        },
      })
      expect(res.status).toBe(200)
      expect((await res.json()) as unknown).toEqual({
        updated: 0,
        failed: [
          { id: "rol_demo_01", reason: "validation" },
          { id: "rol_missing", reason: "not_found" },
        ],
      })
    })

    it("allows setting a System Role to active", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/bulk", {
        method: "PATCH",
        token: accessToken,
        body: { ids: ["rol_admin"], status: "active" },
      })
      expect(res.status).toBe(200)
      expect((await res.json()) as unknown).toEqual({
        updated: 1,
        failed: [],
      })
    })

    it("rejects a malformed whole request with 400", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      for (const body of [
        {},
        { ids: [] },
        { ids: "rol_demo_01", status: "active" },
        { ids: [1], status: "active" },
        { ids: ["rol_demo_01"] },
        { ids: ["rol_demo_01"], title: "Renamed" },
        { ids: ["rol_demo_01"], status: "archived" },
        { ids: ["rol_demo_01"], description: 42 },
      ]) {
        const res = await api("/api/roles/bulk", {
          method: "PATCH",
          token: accessToken,
          body,
        })
        expect([body, res.status]).toEqual([body, 400])
        expect(((await res.json()) as { code: string }).code).toBe(
          "invalid_request"
        )
      }
      expect(roles.all()).toHaveLength(60)
    })
  })

  describe("bulk delete", () => {
    it("deletes every role that is not protected", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      const res = await api("/api/roles/bulk-delete", {
        method: "POST",
        token: accessToken,
        body: { ids: ["rol_demo_08", "rol_demo_09"] },
      })
      expect(res.status).toBe(200)
      expect((await res.json()) as unknown).toEqual({
        deleted: 2,
        failed: [],
      })
      expect(roles.all()).toHaveLength(58)
      for (const id of ["rol_demo_08", "rol_demo_09"]) {
        const gone = await api(`/api/roles/${id}`, { token: accessToken })
        expect(gone.status).toBe(404)
      }
    })

    it("reports not_found, system_role, and referenced failures per row", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      await users.create({
        id: "usr_holder",
        name: "Role Holder",
        email: "holder@example.com",
        roleId: "rol_demo_11",
        password: "holderpass",
        createdAt: "2026-01-01T00:00:00.000Z",
      })

      const res = await api("/api/roles/bulk-delete", {
        method: "POST",
        token: accessToken,
        body: {
          ids: ["rol_demo_10", "rol_missing", "rol_admin", "rol_demo_11"],
        },
      })
      expect(res.status).toBe(200)
      expect((await res.json()) as unknown).toEqual({
        deleted: 1,
        failed: [
          { id: "rol_missing", reason: "not_found" },
          { id: "rol_admin", reason: "system_role" },
          { id: "rol_demo_11", reason: "referenced" },
        ],
      })
      expect(
        roles.findFirst((query) => query.where({ id: "rol_demo_10" }))
      ).toBeUndefined()
      expect(
        roles.findFirst((query) => query.where({ id: "rol_demo_11" }))
      ).toBeDefined()
      expect(
        roles.findFirst((query) => query.where({ id: "rol_admin" }))
      ).toBeDefined()
    })

    it("rejects a malformed whole request with 400", async () => {
      const { accessToken } = await login("admin@example.com", "adminpass")
      for (const body of [
        {},
        { ids: [] },
        { ids: "rol_demo_01" },
        { ids: [1] },
      ]) {
        const res = await api("/api/roles/bulk-delete", {
          method: "POST",
          token: accessToken,
          body,
        })
        expect([body, res.status]).toEqual([body, 400])
      }
      expect(roles.all()).toHaveLength(60)
    })
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

describe("dashboard summary", () => {
  it("requires authentication (401)", async () => {
    const res = await api("/api/dashboard/summary")
    expect(res.status).toBe(401)
  })

  it("returns the zero-filled Task summary for the seeded store", async () => {
    const { accessToken } = await login("member@example.com", "memberpass")
    const res = await api("/api/dashboard/summary", { token: accessToken })
    expect(res.status).toBe(200)

    const summary = (await res.json()) as {
      totals: {
        total: number
        open: number
        overdue: number
        completionRate: number
      }
      byStatus: Array<{ status: string; count: number }>
      byPriority: Array<{ priority: string; count: number }>
      byAssignee: Array<{ assigneeId: string | null; name: string }>
      generatedAt: string
    }

    expect(summary.totals.total).toBe(tasks.all().length)
    expect(summary.totals.open).toBeLessThanOrEqual(summary.totals.total)
    expect(summary.totals.completionRate).toBeGreaterThanOrEqual(0)
    expect(summary.totals.completionRate).toBeLessThanOrEqual(1)
    expect(summary.byStatus.map((entry) => entry.status)).toEqual([
      "todo",
      "in-progress",
      "done",
      "blocked",
    ])
    expect(summary.byPriority.map((entry) => entry.priority)).toEqual([
      "low",
      "medium",
      "high",
      "unassigned",
    ])
    expect(Number.isNaN(Date.parse(summary.generatedAt))).toBe(false)
  })

  it("reflects a created Task on the next read", async () => {
    const { accessToken } = await login("admin@example.com", "adminpass")
    const before = (await (
      await api("/api/dashboard/summary", { token: accessToken })
    ).json()) as {
      totals: { total: number; open: number; overdue: number }
    }

    const created = await api("/api/tasks", {
      method: "POST",
      token: accessToken,
      body: {
        title: "Fresh work",
        status: "todo",
        dueDate: "2020-01-01T00:00:00.000Z",
      },
    })
    expect(created.status).toBe(201)

    const after = (await (
      await api("/api/dashboard/summary", { token: accessToken })
    ).json()) as {
      totals: { total: number; open: number; overdue: number }
    }

    expect(after.totals.total).toBe(before.totals.total + 1)
    expect(after.totals.open).toBe(before.totals.open + 1)
    expect(after.totals.overdue).toBe(before.totals.overdue + 1)
  })
})
