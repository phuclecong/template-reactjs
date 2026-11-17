import { z } from "zod"

/**
 * Zod schemas shared by the mock backend and the web features that validate
 * form values. Kept separate from `collections.ts` so route modules can import
 * schema values without dragging `@msw/data` and the mock collections into
 * their chunks.
 */
export const roleStatusSchema = z.enum(["active", "inactive"])
export const taskStatusSchema = z.enum([
  "todo",
  "in-progress",
  "done",
  "blocked",
])
export const taskPrioritySchema = z.enum(["low", "medium", "high"])

export type RoleStatus = z.infer<typeof roleStatusSchema>
export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskPriority = z.infer<typeof taskPrioritySchema>

/** A persisted Role record, matching the `Role` contract schema. */
export const roleRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: roleStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

/** The Role identity and display summary embedded in a User response. */
export const roleSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: roleStatusSchema,
})

export const userRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  /** The identity of the Role the User holds; every User holds exactly one. */
  roleId: z.string(),
  password: z.string(),
  createdAt: z.string(),
})

/**
 * A stored Due date is a UTC instant. The date-only branch keeps legacy
 * persisted records readable during the migration; reads normalize them to a
 * UTC instant (see `dates.ts`).
 */
export const dueDateSchema = z
  .union([z.string().datetime(), z.string().date()])
  .nullable()
  .optional()

/**
 * A Due date accepted by write requests: only a date-time instant or null.
 * Date-only values are rejected so new writes cannot create legacy records.
 */
export const dueDateWriteSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()

/** An ISO 8601 date-time instant with an explicit offset (or `Z`). */
export const dateTimeSchema = z.string().datetime({ offset: true })

export const taskRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: taskStatusSchema,
  priority: taskPrioritySchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: dueDateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UserRecord = z.infer<typeof userRecordSchema>
export type TaskRecord = z.infer<typeof taskRecordSchema>
export type RoleRecord = z.infer<typeof roleRecordSchema>
export type RoleSummary = z.infer<typeof roleSummarySchema>
