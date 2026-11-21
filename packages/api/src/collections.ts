import { Collection } from "@msw/data"
import { persist } from "@msw/data/extensions/persist"

import { ADMIN_ROLE_ID, MEMBER_ROLE_ID } from "./policy"
import {
  roleRecordSchema,
  taskRecordSchema,
  userRecordSchema,
  type RoleRecord,
  type TaskPriority,
  type TaskStatus,
} from "./schemas"

// Re-export the schema module so existing internal consumers keep their
// imports. Browser code that only needs schema values should import
// `@workspace/api/schemas` directly, which avoids pulling `@msw/data` in.
export * from "./schemas"

// `persist()` is browser-only (a no-op in Node) and hydrates these collections
// from localStorage on construction, so records survive a page reload. The
// smoke tests run in Node and are unaffected.
export const users = new Collection({
  schema: userRecordSchema,
  extensions: [persist()],
})
export const tasks = new Collection({
  schema: taskRecordSchema,
  extensions: [persist()],
})
export const roles = new Collection({
  schema: roleRecordSchema,
  extensions: [persist()],
})

// A record as stored by @msw/data: the schema shape plus internal symbol keys.
export type UserEntity = Awaited<ReturnType<typeof users.create>>
export type TaskEntity = Awaited<ReturnType<typeof tasks.create>>
export type RoleEntity = Awaited<ReturnType<typeof roles.create>>

function nowIso(): string {
  return new Date().toISOString()
}

const titleSeeds = [
  "Draft the release notes",
  "Review the login flow",
  "Fix the table pagination",
  "Refactor the auth provider",
  "Write unit tests for search",
  "Document the API contract",
  "Design the empty state",
  "Ship the onboarding flow",
  "Update the color palette",
  "Investigate the flaky test",
  "Optimize the list rendering",
  "Add sorting to the table",
  "Polish the search suggestions",
  "Handle due-date formatting",
  "Audit the access-control matrix",
] as const

const statusCycle: TaskStatus[] = ["todo", "in-progress", "done", "blocked"]
const priorityCycle: (TaskPriority | null)[] = ["low", "medium", "high", null]

function seedDueDate(index: number): string | null {
  if (index % 3 === 0) return null
  // Noon UTC keeps the seeded instant inside the same calendar day in the
  // timezones the tests and demos use.
  return new Date(Date.UTC(2026, 0, 1 + index, 12, 0, 0)).toISOString()
}

/** Ensures the two demo users exist without touching any registered users. */
export async function ensureSeedUsers(): Promise<void> {
  if (!users.findFirst((query) => query.where({ id: "usr_admin" }))) {
    await users.create({
      id: "usr_admin",
      name: "Ada Admin",
      email: "admin@example.com",
      roleId: ADMIN_ROLE_ID,
      password: "adminpass",
      createdAt: nowIso(),
    })
  }
  if (!users.findFirst((query) => query.where({ id: "usr_member" }))) {
    await users.create({
      id: "usr_member",
      name: "Mia Member",
      email: "member@example.com",
      roleId: MEMBER_ROLE_ID,
      password: "memberpass",
      createdAt: nowIso(),
    })
  }
}

/**
 * The Role seed: the two System Roles plus 58 demo Roles, for 60 total.
 * Demo Roles have no Users and carry deterministic, varied statuses and
 * timestamps so filter and sort behavior is reproducible.
 */
export function roleSeeds(): RoleRecord[] {
  const systemRoles: RoleRecord[] = [
    {
      id: ADMIN_ROLE_ID,
      title: "Administrator",
      description: "Full access to every resource.",
      status: "active",
      createdAt: "2025-12-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: MEMBER_ROLE_ID,
      title: "Member",
      description: "Read-only access to the dashboard.",
      status: "active",
      createdAt: "2025-12-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    },
  ]

  const demoRoles: RoleRecord[] = []
  for (let i = 0; i < 58; i++) {
    const num = i + 1
    demoRoles.push({
      id: `rol_demo_${String(num).padStart(2, "0")}`,
      title: `Demo Role ${String(num).padStart(2, "0")}`,
      description: i % 4 === 0 ? null : `Description for demo role ${num}`,
      status: i % 2 === 0 ? "active" : "inactive",
      // Distinct instants spread across January–February 2026.
      createdAt: new Date(Date.UTC(2026, 0, 1 + i, 12, 0, 0)).toISOString(),
      // Distinct instants spread across March–April 2026.
      updatedAt: new Date(Date.UTC(2026, 2, 1 + i, 9, 30, 0)).toISOString(),
    })
  }

  return [...systemRoles, ...demoRoles]
}

/** Ensures the Role seed exists without touching any other Roles. */
export async function ensureSeedRoles(): Promise<void> {
  for (const seed of roleSeeds()) {
    if (!roles.findFirst((query) => query.where({ id: seed.id }))) {
      await roles.create(seed)
    }
  }
}

/** Seeds users and a large Task set (assumes an empty store; call after clear). */
export async function seedDb(): Promise<void> {
  await ensureSeedUsers()
  await ensureSeedRoles()

  // The first two tasks are kept stable (ids, assignees, titles) because the
  // smoke tests reference them directly.
  await tasks.create({
    id: "tsk_001",
    title: "Author the OpenAPI contract",
    description: "Single source of truth for the API.",
    status: "done",
    priority: "high",
    assigneeId: "usr_admin",
    dueDate: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
  await tasks.create({
    id: "tsk_002",
    title: "Build the MSW mock",
    description: null,
    status: "in-progress",
    priority: "medium",
    assigneeId: "usr_member",
    dueDate: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })

  const extraTasks = 148
  for (let i = 0; i < extraTasks; i++) {
    const num = i + 3
    const timestamp = nowIso()
    await tasks.create({
      id: `tsk_${String(num).padStart(3, "0")}`,
      title: `${titleSeeds[i % titleSeeds.length]!} #${num}`,
      description: i % 2 === 0 ? `Description for task #${num}` : null,
      status: statusCycle[i % statusCycle.length]!,
      priority: priorityCycle[i % priorityCycle.length] ?? null,
      assigneeId: i % 5 === 0 ? null : i % 2 === 0 ? "usr_admin" : "usr_member",
      dueDate: seedDueDate(i),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
}

/** Clears and re-seeds the store. Safe to call repeatedly. */
export async function resetDb(): Promise<void> {
  users.clear()
  tasks.clear()
  roles.clear()
  await seedDb()
}
