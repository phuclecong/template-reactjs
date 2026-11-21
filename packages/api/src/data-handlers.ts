import { http, HttpResponse, type JsonBodyType } from "msw"
import {
  dateTimeSchema,
  dueDateWriteSchema,
  roles,
  tasks,
  users,
  type RoleEntity,
  type RoleStatus,
  type TaskEntity,
  type TaskPriority,
  type TaskStatus,
  type UserEntity,
} from "./collections"
import {
  compareDueDates,
  dueDateInstant,
  normalizeDueDateInstant,
  normalizeStoredDueDate,
} from "./dates"
import { isAdministratorRole, isSystemRole } from "./policy"
import {
  getUserByAccessToken,
  loginUser,
  refreshAccessToken,
  registerUser,
  toPublicUser,
  type ServiceResult,
} from "./service"

// Stateful, hand-written handlers. Kept free of `node:fs`, `fromOpenApi`, and
// top-level `await` so this module can be bundled into the browser MSW worker;
// `handlers.ts` composes these with the spec-generated fallback for Node.

type JsonBody = Record<string, unknown>

async function readJson(request: Request): Promise<JsonBody | null> {
  try {
    const value: unknown = await request.json()
    return typeof value === "object" && value !== null
      ? (value as JsonBody)
      : null
  } catch {
    return null
  }
}

function ok(body: unknown, status = 200): Response {
  return HttpResponse.json(body as JsonBodyType, { status })
}

function fail(code: string, message: string, status: number): Response {
  return HttpResponse.json({ code, message }, { status })
}

function respond(result: ServiceResult): Response {
  return ok(result.body, result.status)
}

function getAuthUser(request: Request): UserEntity | null {
  const header = request.headers.get("authorization")
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : null
  return getUserByAccessToken(token)
}

function pathParam(
  value: string | readonly string[] | undefined
): string | undefined {
  if (typeof value === "string") return value
  return value?.[0]
}

function isStatus(value: unknown): value is TaskStatus {
  return (
    value === "todo" ||
    value === "in-progress" ||
    value === "done" ||
    value === "blocked"
  )
}

function isPriority(value: unknown): value is TaskPriority {
  return value === "low" || value === "medium" || value === "high"
}

const sortableTaskFields = ["title", "status", "priority", "dueDate"] as const
type SortableTaskField = (typeof sortableTaskFields)[number]

function isSortableTaskField(value: string | null): value is SortableTaskField {
  return (
    value !== null && (sortableTaskFields as readonly string[]).includes(value)
  )
}

function compareTaskValues(
  a: TaskEntity,
  b: TaskEntity,
  field: SortableTaskField
): number {
  if (field === "dueDate") return compareDueDates(a.dueDate, b.dueDate)
  const av = a[field]
  const bv = b[field]
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  return String(av).localeCompare(String(bv))
}

/** Normalizes legacy date-only Due dates before returning a Task. */
function toPublicTask(task: TaskEntity): TaskEntity {
  return { ...task, dueDate: normalizeStoredDueDate(task.dueDate) }
}

const sortableUserFields = ["name", "email", "roleId", "createdAt"] as const
type SortableUserField = (typeof sortableUserFields)[number]

function isSortableUserField(value: string | null): value is SortableUserField {
  return (
    value !== null && (sortableUserFields as readonly string[]).includes(value)
  )
}

function compareUserValues(
  a: UserEntity,
  b: UserEntity,
  field: SortableUserField
): number {
  const av = a[field]
  const bv = b[field]
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  return String(av).localeCompare(String(bv))
}

/** Lists users with simple-rest compatible `_start`/`_end`/`_sort`/`_order`/`q`/`roleId`. */
function listUsers(request: Request): Response {
  if (!getAuthUser(request)) {
    return fail("unauthorized", "Authentication required.", 401)
  }

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim().toLowerCase()
  const roleId = url.searchParams.get("roleId")
  const start = Number(url.searchParams.get("_start") ?? 0)
  const endParam = url.searchParams.get("_end")
  const end = endParam ? Number(endParam) : undefined
  const sortParam = url.searchParams.get("_sort")
  const descending = url.searchParams.get("_order") === "desc"
  const sortField: SortableUserField = isSortableUserField(sortParam)
    ? sortParam
    : "name"

  let items = users.all().slice()
  if (q) {
    items = items.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
    )
  }
  if (roleId) {
    items = items.filter((user) => user.roleId === roleId)
  }

  items.sort((a, b) => {
    const result = compareUserValues(a, b, sortField)
    return descending ? -result : result
  })

  const total = items.length
  const page = end === undefined ? items : items.slice(start, end)
  return HttpResponse.json(page.map(toPublicUser) as JsonBodyType, {
    status: 200,
    headers: { "x-total-count": String(total) },
  })
}

/**
 * Parses a Due date filter bound. Only date-time instants are accepted; the
 * web app converts date-only URL bounds to local-day UTC instants before it
 * queries. Empty or missing bounds are ignored.
 */
function parseDueDateBound(raw: string | null): {
  valid: boolean
  value: number | null
} {
  if (raw === null || raw === "") return { valid: true, value: null }
  const parsed = dueDateWriteSchema.safeParse(raw)
  if (!parsed.success || parsed.data == null) {
    return { valid: false, value: null }
  }
  return { valid: true, value: Date.parse(parsed.data) }
}

/** Lists tasks with simple-rest compatible `_start`/`_end`/`_sort`/`_order`/`q`. */
function listTasks(request: Request): Response {
  if (!getAuthUser(request)) {
    return fail("unauthorized", "Authentication required.", 401)
  }

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim().toLowerCase()
  const statuses = url.searchParams
    .getAll("status")
    .filter((value) => value !== "")
  const priorities = url.searchParams
    .getAll("priority")
    .filter((value) => value !== "")
  const assigneeIds = url.searchParams
    .getAll("assigneeId")
    .filter((value) => value !== "")
  if (statuses.some((value) => !isStatus(value))) {
    return fail(
      "invalid_request",
      "status must be one of: todo, in-progress, done, blocked.",
      400
    )
  }
  if (priorities.some((value) => !isPriority(value))) {
    return fail(
      "invalid_request",
      "priority must be one of: low, medium, high.",
      400
    )
  }
  const userIds = new Set(users.all().map((user) => user.id))
  if (
    assigneeIds.some((value) => value !== "unassigned" && !userIds.has(value))
  ) {
    return fail(
      "invalid_request",
      'assigneeId must be "unassigned" or an existing user id.',
      400
    )
  }
  const dueDateGte = parseDueDateBound(url.searchParams.get("dueDate_gte"))
  if (!dueDateGte.valid) {
    return fail(
      "invalid_request",
      "dueDate_gte must be an ISO 8601 date-time.",
      400
    )
  }
  const dueDateLte = parseDueDateBound(url.searchParams.get("dueDate_lte"))
  if (!dueDateLte.valid) {
    return fail(
      "invalid_request",
      "dueDate_lte must be an ISO 8601 date-time.",
      400
    )
  }
  const dueDateGteMs = dueDateGte.value
  const dueDateLteMs = dueDateLte.value
  const start = Number(url.searchParams.get("_start") ?? 0)
  const endParam = url.searchParams.get("_end")
  const end = endParam ? Number(endParam) : undefined
  const sortParam = url.searchParams.get("_sort")
  const descending = url.searchParams.get("_order") === "desc"
  const sortField: SortableTaskField = isSortableTaskField(sortParam)
    ? sortParam
    : "title"

  let items = tasks.all().slice()
  if (q) {
    items = items.filter((task) => task.title.toLowerCase().includes(q))
  }
  if (statuses.length > 0) {
    // OR within the field; other fields are ANDed below.
    items = items.filter((task) => statuses.includes(task.status))
  }
  if (priorities.length > 0) {
    // OR within the field; other fields are ANDed.
    items = items.filter(
      (task) => task.priority != null && priorities.includes(task.priority)
    )
  }
  if (assigneeIds.length > 0) {
    const includeUnassigned = assigneeIds.includes("unassigned")
    items = items.filter((task) =>
      task.assigneeId == null
        ? includeUnassigned
        : assigneeIds.includes(task.assigneeId)
    )
  }
  if (dueDateGteMs != null) {
    items = items.filter((task) => {
      const instant = dueDateInstant(task.dueDate)
      return instant != null && instant >= dueDateGteMs
    })
  }
  if (dueDateLteMs != null) {
    items = items.filter((task) => {
      const instant = dueDateInstant(task.dueDate)
      return instant != null && instant <= dueDateLteMs
    })
  }
  items.sort((a, b) => {
    const result = compareTaskValues(a, b, sortField)
    return descending ? -result : result
  })

  const total = items.length
  const page = end === undefined ? items : items.slice(start, end)
  return HttpResponse.json(page.map(toPublicTask) as JsonBodyType, {
    status: 200,
    headers: { "x-total-count": String(total) },
  })
}

/** Applies a partial update to several tasks; members may only touch their own. */
async function bulkUpdateTasks(request: Request): Promise<Response> {
  const actor = getAuthUser(request)
  if (!actor) return fail("unauthorized", "Authentication required.", 401)

  const body = await readJson(request)
  if (!body) return fail("invalid_request", "A JSON body is required.", 400)

  const rawIds = body.ids
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string")
    : []
  if (ids.length === 0) {
    return fail("invalid_request", "A non-empty ids array is required.", 400)
  }

  const hasStatus = isStatus(body.status)
  const hasPriority = isPriority(body.priority) || body.priority === null
  const hasAssigneeId =
    typeof body.assigneeId === "string" || body.assigneeId === null
  const dueDate = dueDateWriteSchema.safeParse(body.dueDate)
  if (!dueDate.success) {
    return fail(
      "invalid_request",
      "dueDate must be an ISO 8601 date-time.",
      400
    )
  }
  const hasDueDate = body.dueDate !== undefined
  const normalizedDueDate = normalizeDueDateInstant(dueDate.data ?? null)

  if (!hasStatus && !hasPriority && !hasAssigneeId && !hasDueDate) {
    return fail(
      "invalid_request",
      "At least one of status, priority, assigneeId, or dueDate is required.",
      400
    )
  }

  let updated = 0
  const failed: Array<{ id: string; reason: string }> = []

  for (const id of ids) {
    const target = tasks.findFirst((query) => query.where({ id }))
    if (!target) {
      failed.push({ id, reason: "not_found" })
      continue
    }
    if (!isAdministrator(actor) && target.assigneeId !== actor.id) {
      failed.push({ id, reason: "forbidden" })
      continue
    }

    await tasks.update(target, {
      data(draft) {
        if (hasStatus) draft.status = body.status as TaskStatus
        if (hasPriority) draft.priority = body.priority as TaskPriority | null
        if (hasAssigneeId) draft.assigneeId = body.assigneeId as string | null
        if (hasDueDate) draft.dueDate = normalizedDueDate
        draft.updatedAt = new Date().toISOString()
      },
      strict: true,
    })
    updated += 1
  }

  return ok({ updated, failed })
}

function isRoleStatus(value: unknown): value is RoleStatus {
  return value === "active" || value === "inactive"
}

const sortableRoleFields = [
  "title",
  "status",
  "createdAt",
  "updatedAt",
] as const
type SortableRoleField = (typeof sortableRoleFields)[number]

function isSortableRoleField(value: string | null): value is SortableRoleField {
  return (
    value !== null && (sortableRoleFields as readonly string[]).includes(value)
  )
}

function compareRoleValues(
  a: RoleEntity,
  b: RoleEntity,
  field: SortableRoleField
): number {
  if (field === "createdAt" || field === "updatedAt") {
    return Date.parse(a[field]) - Date.parse(b[field])
  }
  return a[field].localeCompare(b[field])
}

/**
 * Parses a Role date filter bound. Returns `null` when absent, `undefined` when
 * invalid, or the epoch milliseconds to compare against. Only ISO 8601
 * date-time instants are accepted.
 */
function parseRoleDateBound(raw: string | null): number | null | undefined {
  if (raw === null || raw === "") return null
  const parsed = dateTimeSchema.safeParse(raw)
  if (!parsed.success) return undefined
  return Date.parse(parsed.data)
}

/** Lists roles with simple-rest compatible `_start`/`_end`/`_sort`/`_order`. */
function listRoles(request: Request): Response {
  if (!getAuthUser(request)) {
    return fail("unauthorized", "Authentication required.", 401)
  }

  const url = new URL(request.url)
  const titleLike = url.searchParams.get("title_like")?.toLowerCase()
  const descriptionLike = url.searchParams
    .get("description_like")
    ?.toLowerCase()
  const statuses = url.searchParams
    .getAll("status")
    .filter((value) => value !== "")
  if (statuses.some((value) => !isRoleStatus(value))) {
    return fail(
      "invalid_request",
      "status must be one of: active, inactive.",
      400
    )
  }
  const createdAtGte = parseRoleDateBound(url.searchParams.get("createdAt_gte"))
  if (createdAtGte === undefined) {
    return fail(
      "invalid_request",
      "createdAt_gte must be an ISO 8601 date-time.",
      400
    )
  }
  const createdAtLte = parseRoleDateBound(url.searchParams.get("createdAt_lte"))
  if (createdAtLte === undefined) {
    return fail(
      "invalid_request",
      "createdAt_lte must be an ISO 8601 date-time.",
      400
    )
  }
  const updatedAtGte = parseRoleDateBound(url.searchParams.get("updatedAt_gte"))
  if (updatedAtGte === undefined) {
    return fail(
      "invalid_request",
      "updatedAt_gte must be an ISO 8601 date-time.",
      400
    )
  }
  const updatedAtLte = parseRoleDateBound(url.searchParams.get("updatedAt_lte"))
  if (updatedAtLte === undefined) {
    return fail(
      "invalid_request",
      "updatedAt_lte must be an ISO 8601 date-time.",
      400
    )
  }
  const start = Number(url.searchParams.get("_start") ?? 0)
  const endParam = url.searchParams.get("_end")
  const end = endParam ? Number(endParam) : undefined
  const sortParam = url.searchParams.get("_sort")
  const descending = url.searchParams.get("_order") === "desc"
  const sortField: SortableRoleField = isSortableRoleField(sortParam)
    ? sortParam
    : "title"

  let items = roles.all().slice()
  if (titleLike) {
    items = items.filter((role) => role.title.toLowerCase().includes(titleLike))
  }
  if (descriptionLike) {
    items = items.filter(
      (role) =>
        role.description != null &&
        role.description.toLowerCase().includes(descriptionLike)
    )
  }
  if (statuses.length > 0) {
    // OR within the field; other fields are ANDed below.
    items = items.filter((role) => statuses.includes(role.status))
  }
  if (createdAtGte != null) {
    items = items.filter((role) => Date.parse(role.createdAt) >= createdAtGte)
  }
  if (createdAtLte != null) {
    items = items.filter((role) => Date.parse(role.createdAt) <= createdAtLte)
  }
  if (updatedAtGte != null) {
    items = items.filter((role) => Date.parse(role.updatedAt) >= updatedAtGte)
  }
  if (updatedAtLte != null) {
    items = items.filter((role) => Date.parse(role.updatedAt) <= updatedAtLte)
  }

  items.sort((a, b) => {
    const result = compareRoleValues(a, b, sortField)
    return descending ? -result : result
  })

  const total = items.length
  const page = end === undefined ? items : items.slice(start, end)
  return HttpResponse.json(page as JsonBodyType, {
    status: 200,
    headers: { "x-total-count": String(total) },
  })
}

/** Returns a Role by id, or 404. Any authenticated caller may read it. */
function getRole(request: Request, id: string | undefined): Response {
  if (!getAuthUser(request)) {
    return fail("unauthorized", "Authentication required.", 401)
  }
  const role = id ? roles.findFirst((query) => query.where({ id })) : undefined
  if (!role) return fail("not_found", "Role not found.", 404)
  return ok(role)
}

const ROLE_TITLE_MAX = 100
const ROLE_DESCRIPTION_MAX = 500

/** Administrator access is holding the Administrator System Role. */
function isAdministrator(user: UserEntity): boolean {
  return isAdministratorRole(user.roleId)
}

function userHoldsRole(user: UserEntity, roleId: string): boolean {
  return user.roleId === roleId
}

function isRoleReferenced(roleId: string): boolean {
  return users.all().some((user) => userHoldsRole(user, roleId))
}

/** Finds a Role whose trimmed title matches case-insensitively. */
function findRoleByTitle(
  title: string,
  excludeId?: string
): RoleEntity | undefined {
  const key = title.toLowerCase()
  return roles
    .all()
    .find(
      (role) => role.id !== excludeId && role.title.trim().toLowerCase() === key
    )
}

type Normalized<T> = { ok: true; value: T } | { ok: false }

function normalizeRoleTitle(raw: unknown): Normalized<string> {
  if (typeof raw !== "string") return { ok: false }
  const value = raw.trim()
  if (value.length < 1 || value.length > ROLE_TITLE_MAX) return { ok: false }
  return { ok: true, value }
}

/** Trims a description; a blank value becomes null. */
function normalizeRoleDescription(raw: unknown): Normalized<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  if (typeof raw !== "string") return { ok: false }
  const value = raw.trim()
  if (value.length > ROLE_DESCRIPTION_MAX) return { ok: false }
  return { ok: true, value: value === "" ? null : value }
}

type AdminGuard = { actor: UserEntity } | { response: Response }

/** Enforces the Administrator-only write rule. */
function requireAdministrator(request: Request): AdminGuard {
  const actor = getAuthUser(request)
  if (!actor) {
    return { response: fail("unauthorized", "Authentication required.", 401) }
  }
  if (!isAdministrator(actor)) {
    return {
      response: fail("forbidden", "Administrator role required.", 403),
    }
  }
  return { actor }
}

async function createRole(request: Request): Promise<Response> {
  const guard = requireAdministrator(request)
  if ("response" in guard) return guard.response

  const body = await readJson(request)
  if (!body) return fail("invalid_request", "A JSON body is required.", 400)

  const title = normalizeRoleTitle(body.title)
  if (!title.ok) {
    return fail(
      "invalid_request",
      "title is required and must be 1-100 characters after trimming.",
      400
    )
  }
  const description = normalizeRoleDescription(body.description)
  if (!description.ok) {
    return fail(
      "invalid_request",
      "description must be at most 500 characters after trimming.",
      400
    )
  }
  const status = body.status === undefined ? "active" : body.status
  if (!isRoleStatus(status)) {
    return fail(
      "invalid_request",
      "status must be one of: active, inactive.",
      400
    )
  }
  if (findRoleByTitle(title.value)) {
    return fail(
      "duplicate_title",
      "A role with this title already exists.",
      409
    )
  }

  const timestamp = new Date().toISOString()
  const role = await roles.create({
    id: `rol_${crypto.randomUUID()}`,
    title: title.value,
    description: description.value,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return ok(role, 201)
}

async function updateRole(
  request: Request,
  id: string | undefined
): Promise<Response> {
  const guard = requireAdministrator(request)
  if ("response" in guard) return guard.response

  const target = id
    ? roles.findFirst((query) => query.where({ id }))
    : undefined
  if (!target) return fail("not_found", "Role not found.", 404)

  const body = await readJson(request)
  if (!body) return fail("invalid_request", "A JSON body is required.", 400)

  let title: string | undefined
  if (body.title !== undefined) {
    const normalized = normalizeRoleTitle(body.title)
    if (!normalized.ok) {
      return fail(
        "invalid_request",
        "title must be 1-100 characters after trimming.",
        400
      )
    }
    if (findRoleByTitle(normalized.value, target.id)) {
      return fail(
        "duplicate_title",
        "A role with this title already exists.",
        409
      )
    }
    title = normalized.value
  }

  let description: string | null | undefined
  if (body.description !== undefined) {
    const normalized = normalizeRoleDescription(body.description)
    if (!normalized.ok) {
      return fail(
        "invalid_request",
        "description must be at most 500 characters after trimming.",
        400
      )
    }
    description = normalized.value
  }

  let status: RoleStatus | undefined
  if (body.status !== undefined) {
    if (!isRoleStatus(body.status)) {
      return fail(
        "invalid_request",
        "status must be one of: active, inactive.",
        400
      )
    }
    if (body.status === "inactive" && isSystemRole(target.id)) {
      return fail("system_role", "System roles cannot be set to inactive.", 409)
    }
    status = body.status
  }

  const updated = await roles.update(target, {
    data(draft) {
      // `id` and `createdAt` are immutable; `updatedAt` is server-managed.
      if (title !== undefined) draft.title = title
      if (description !== undefined) draft.description = description
      if (status !== undefined) draft.status = status
      draft.updatedAt = new Date().toISOString()
    },
    strict: true,
  })
  return ok(updated)
}

function deleteRole(request: Request, id: string | undefined): Response {
  const guard = requireAdministrator(request)
  if ("response" in guard) return guard.response

  const target = id
    ? roles.findFirst((query) => query.where({ id }))
    : undefined
  if (!target) return fail("not_found", "Role not found.", 404)
  if (isSystemRole(target.id)) {
    return fail("system_role", "System roles cannot be deleted.", 409)
  }
  if (isRoleReferenced(target.id)) {
    return fail(
      "referenced",
      "This role is assigned to a user and cannot be deleted.",
      409
    )
  }
  roles.delete(target)
  return new HttpResponse(null, { status: 204 })
}

/** Parses a non-empty array of distinct role ids, or returns null. */
function parseRoleIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every((id): id is string => typeof id === "string" && id !== "")) {
    return null
  }
  return [...new Set(raw)]
}

interface BulkFailure {
  id: string
  reason: "not_found" | "system_role" | "referenced" | "validation"
}

async function bulkUpdateRoles(request: Request): Promise<Response> {
  const guard = requireAdministrator(request)
  if ("response" in guard) return guard.response

  const body = await readJson(request)
  if (!body) return fail("invalid_request", "A JSON body is required.", 400)

  const ids = parseRoleIds(body.ids)
  if (!ids) {
    return fail(
      "invalid_request",
      "A non-empty ids array of strings is required.",
      400
    )
  }
  if ("title" in body) {
    return fail("invalid_request", "title cannot be bulk edited.", 400)
  }

  const hasDescription = body.description !== undefined
  const hasStatus = body.status !== undefined
  if (!hasDescription && !hasStatus) {
    return fail(
      "invalid_request",
      "At least one of description or status is required.",
      400
    )
  }
  if (hasStatus && !isRoleStatus(body.status)) {
    return fail(
      "invalid_request",
      "status must be one of: active, inactive.",
      400
    )
  }

  let description: string | null = null
  let descriptionValid = true
  if (hasDescription) {
    if (body.description !== null && typeof body.description !== "string") {
      return fail(
        "invalid_request",
        "description must be a string or null.",
        400
      )
    }
    const normalized = normalizeRoleDescription(body.description)
    if (normalized.ok) {
      description = normalized.value
    } else {
      descriptionValid = false
    }
  }
  const status = hasStatus ? (body.status as RoleStatus) : undefined

  let updated = 0
  const failed: BulkFailure[] = []
  for (const id of ids) {
    const target = roles.findFirst((query) => query.where({ id }))
    if (!target) {
      failed.push({ id, reason: "not_found" })
      continue
    }
    if (!descriptionValid) {
      failed.push({ id, reason: "validation" })
      continue
    }
    if (status === "inactive" && isSystemRole(id)) {
      failed.push({ id, reason: "system_role" })
      continue
    }
    await roles.update(target, {
      data(draft) {
        if (hasDescription) draft.description = description
        if (status !== undefined) draft.status = status
        draft.updatedAt = new Date().toISOString()
      },
      strict: true,
    })
    updated += 1
  }

  return ok({ updated, failed })
}

async function bulkDeleteRoles(request: Request): Promise<Response> {
  const guard = requireAdministrator(request)
  if ("response" in guard) return guard.response

  const body = await readJson(request)
  if (!body) return fail("invalid_request", "A JSON body is required.", 400)

  const ids = parseRoleIds(body.ids)
  if (!ids) {
    return fail(
      "invalid_request",
      "A non-empty ids array of strings is required.",
      400
    )
  }

  // One pass over Users per action instead of one full scan per selected id.
  const heldRoleIds = new Set(users.all().map((user) => user.roleId))

  let deleted = 0
  const failed: BulkFailure[] = []
  for (const id of ids) {
    const target = roles.findFirst((query) => query.where({ id }))
    if (!target) {
      failed.push({ id, reason: "not_found" })
      continue
    }
    if (isSystemRole(id)) {
      failed.push({ id, reason: "system_role" })
      continue
    }
    if (heldRoleIds.has(id)) {
      failed.push({ id, reason: "referenced" })
      continue
    }
    roles.delete(target)
    deleted += 1
  }

  return ok({ deleted, failed })
}

export const dataHandlers = [
  // ---- auth ----
  http.post("*/api/auth/register", async ({ request }) => {
    const body = await readJson(request)
    return respond(await registerUser(body?.name, body?.email, body?.password))
  }),

  http.post("*/api/auth/login", async ({ request }) => {
    const body = await readJson(request)
    return respond(await loginUser(body?.email, body?.password))
  }),

  http.post("*/api/auth/refresh", async ({ request }) => {
    const body = await readJson(request)
    return respond(refreshAccessToken(body?.refreshToken))
  }),

  http.post("*/api/auth/logout", ({ request }) => {
    if (!getAuthUser(request)) {
      return fail("unauthorized", "Authentication required.", 401)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- users ----
  http.get("*/api/users", ({ request }) => listUsers(request)),

  http.patch("*/api/users/:id/role", async ({ request, params }) => {
    const actor = getAuthUser(request)
    if (!actor) return fail("unauthorized", "Authentication required.", 401)
    if (!isAdministrator(actor)) {
      return fail("forbidden", "Admin role required.", 403)
    }
    const id = pathParam(params.id)
    const target = id
      ? users.findFirst((query) => query.where({ id }))
      : undefined
    if (!target) return fail("not_found", "User not found.", 404)

    const body = await readJson(request)
    const roleId = body?.roleId
    if (typeof roleId !== "string" || roleId === "") {
      return fail("invalid_request", "A roleId is required.", 400)
    }
    const role = roles.findFirst((query) => query.where({ id: roleId }))
    if (!role) {
      return fail("invalid_request", "The role does not exist.", 400)
    }
    if (role.status !== "active") {
      return fail(
        "invalid_request",
        "An inactive role cannot be assigned.",
        400
      )
    }
    const updated = await users.update(target, {
      data(draft) {
        draft.roleId = roleId
      },
      strict: true,
    })
    return ok(toPublicUser(updated))
  }),

  http.delete("*/api/users/:id", ({ request, params }) => {
    const actor = getAuthUser(request)
    if (!actor) return fail("unauthorized", "Authentication required.", 401)
    if (!isAdministrator(actor)) {
      return fail("forbidden", "Admin role required.", 403)
    }
    const id = pathParam(params.id)
    const target = id
      ? users.findFirst((query) => query.where({ id }))
      : undefined
    if (!target) return fail("not_found", "User not found.", 404)
    users.delete(target)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- tasks ----
  http.get("*/api/tasks", ({ request }) => listTasks(request)),

  http.post("*/api/tasks", async ({ request }) => {
    const actor = getAuthUser(request)
    if (!actor) return fail("unauthorized", "Authentication required.", 401)
    const body = await readJson(request)
    if (!body || typeof body.title !== "string" || body.title.trim() === "") {
      return fail("invalid_request", "A title is required.", 400)
    }
    const dueDate = dueDateWriteSchema.safeParse(body.dueDate)
    if (!dueDate.success) {
      return fail(
        "invalid_request",
        "dueDate must be an ISO 8601 date-time.",
        400
      )
    }
    const timestamp = new Date().toISOString()
    const task = await tasks.create({
      id: `tsk_${crypto.randomUUID()}`,
      title: body.title,
      description:
        typeof body.description === "string" ? body.description : null,
      status: isStatus(body.status) ? body.status : "todo",
      priority: isPriority(body.priority) ? body.priority : null,
      assigneeId:
        body.assigneeId === null
          ? null
          : typeof body.assigneeId === "string"
            ? body.assigneeId
            : actor.id,
      dueDate: normalizeDueDateInstant(dueDate.data ?? null),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    return ok(toPublicTask(task), 201)
  }),

  http.patch("*/api/tasks/bulk", ({ request }) => bulkUpdateTasks(request)),

  http.patch("*/api/tasks/:id", async ({ request, params }) => {
    const actor = getAuthUser(request)
    if (!actor) return fail("unauthorized", "Authentication required.", 401)
    const id = pathParam(params.id)
    const target = id
      ? tasks.findFirst((query) => query.where({ id }))
      : undefined
    if (!target) return fail("not_found", "Task not found.", 404)
    if (!isAdministrator(actor) && target.assigneeId !== actor.id) {
      return fail("forbidden", "You can only update your own tasks.", 403)
    }

    const body = await readJson(request)
    const dueDate = dueDateWriteSchema.safeParse(body?.dueDate)
    if (!dueDate.success) {
      return fail(
        "invalid_request",
        "dueDate must be an ISO 8601 date-time.",
        400
      )
    }
    const updated = await tasks.update(target, {
      data(draft) {
        if (typeof body?.title === "string" && body.title.trim() !== "") {
          draft.title = body.title
        }
        if (
          typeof body?.description === "string" ||
          body?.description === null
        ) {
          draft.description = body.description
        }
        if (isStatus(body?.status)) draft.status = body.status
        if (isPriority(body?.priority) || body?.priority === null) {
          draft.priority = body.priority
        }
        if (typeof body?.assigneeId === "string" || body?.assigneeId === null) {
          draft.assigneeId = body.assigneeId
        }
        if (body?.dueDate !== undefined) {
          draft.dueDate = normalizeDueDateInstant(dueDate.data ?? null)
        }
        draft.updatedAt = new Date().toISOString()
      },
      strict: true,
    })
    return ok(toPublicTask(updated))
  }),

  http.delete("*/api/tasks/:id", ({ request, params }) => {
    const actor = getAuthUser(request)
    if (!actor) return fail("unauthorized", "Authentication required.", 401)
    const id = pathParam(params.id)
    const target = id
      ? tasks.findFirst((query) => query.where({ id }))
      : undefined
    if (!target) return fail("not_found", "Task not found.", 404)
    if (!isAdministrator(actor) && target.assigneeId !== actor.id) {
      return fail("forbidden", "You can only delete your own tasks.", 403)
    }
    tasks.delete(target)
    return new HttpResponse(null, { status: 204 })
  }),

  // ---- roles ----
  http.get("*/api/roles", ({ request }) => listRoles(request)),

  http.post("*/api/roles", ({ request }) => createRole(request)),

  http.patch("*/api/roles/bulk", ({ request }) => bulkUpdateRoles(request)),

  http.post("*/api/roles/bulk-delete", ({ request }) =>
    bulkDeleteRoles(request)
  ),

  http.get("*/api/roles/:id", ({ request, params }) =>
    getRole(request, pathParam(params.id))
  ),

  http.patch("*/api/roles/:id", ({ request, params }) =>
    updateRole(request, pathParam(params.id))
  ),

  http.delete("*/api/roles/:id", ({ request, params }) =>
    deleteRole(request, pathParam(params.id))
  ),

  // ---- password ----
  http.put("*/api/password", async ({ request }) => {
    const actor = getAuthUser(request)
    if (!actor) return fail("unauthorized", "Authentication required.", 401)
    const body = await readJson(request)
    if (
      !body ||
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return fail(
        "invalid_request",
        "currentPassword and newPassword are required.",
        400
      )
    }
    if (actor.password !== body.currentPassword) {
      return fail("invalid_credentials", "Current password is incorrect.", 401)
    }
    const newPassword = body.newPassword
    await users.update(actor, {
      data(draft) {
        draft.password = newPassword
      },
      strict: true,
    })
    return new HttpResponse(null, { status: 204 })
  }),
]
