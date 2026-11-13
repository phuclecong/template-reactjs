import type { CrudFilter } from "@refinedev/core"
import {
  taskPrioritySchema,
  taskStatusSchema,
  type Role,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
  type UserRecord,
} from "@workspace/api/collections"
import {
  dateOnlyToLocalDate,
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
  normalizeLegacyDateValue,
  toUtcInstant,
} from "@workspace/ui/lib/date"

export type { Role, TaskPriority, TaskRecord, TaskStatus }

/** All Task Statuses in display order, derived from the API contract. */
export const STATUS_OPTIONS = taskStatusSchema.options

/** All Task Priorities in display order, derived from the API contract. */
export const PRIORITY_OPTIONS = taskPrioritySchema.options

/**
 * Convert a stored Due date to the form value the DatePicker edits: the UTC
 * instant itself, with legacy date-only records normalized to local midnight.
 */
export function dueDateToFormValue(dueDate: string | null | undefined): string {
  return normalizeLegacyDateValue(dueDate) ?? ""
}

/**
 * Convert the form value back to the UTC instant the API stores. The picker
 * emits instants; a date-only value is rejected (null) rather than silently
 * normalized, because new writes must be date-time instants. Empty clears
 * the Due date.
 */
export function formValueToDueDate(value: string): string | null {
  return toUtcInstant(value)
}

/** The slice of a User the task views need: an id and a display name. */
export type UserOption = Pick<UserRecord, "id" | "name">

/** The identity the task views read from the auth provider. */
export type CurrentUser = Pick<UserRecord, "id" | "role">

/** The TaskRecord fields that are optional and nullable in the API contract. */
type NullableTaskField = "description" | "priority" | "assigneeId" | "dueDate"

/**
 * Makes the listed fields required, collapsing `undefined` into the remaining
 * union (`string | null`, `TaskPriority | null`, …). Used once the API's
 * optional nullable fields have been normalized for payloads and rows.
 */
type ResolvedNullable<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: Exclude<T[P], undefined>
}

/** A Task enriched for display in the table. */
export type TaskRow = ResolvedNullable<
  Omit<TaskRecord, "createdAt" | "updatedAt">,
  NullableTaskField
> & {
  assigneeName: string
  canModify: boolean
}

/** The fields the write path sends when creating or updating a Task. */
export type TaskInput = ResolvedNullable<
  Omit<TaskRecord, "id" | "createdAt" | "updatedAt">,
  NullableTaskField
>

/** Keys the task table reads from the URL query string. */
export const TASK_FILTER_KEYS = [
  "status",
  "priority",
  "assignee",
  "dueFrom",
  "dueTo",
] as const

export type TaskFilterKey = (typeof TASK_FILTER_KEYS)[number]

/** URL filter values for the task table. */
export type TaskFilters = Record<TaskFilterKey, string>

/**
 * Every filter cleared. Derived from `TASK_FILTER_KEYS`, so adding a filter
 * edits the key list once.
 */
export const EMPTY_TASK_FILTERS = Object.fromEntries(
  TASK_FILTER_KEYS.map((key) => [key, ""])
) as TaskFilters

/**
 * Compare two filter records by value, independent of object identity. Derived
 * from the key list so every existing and future filter is compared.
 */
export function taskFiltersEqual(a: TaskFilters, b: TaskFilters): boolean {
  return TASK_FILTER_KEYS.every((key) => a[key] === b[key])
}

/**
 * Split a comma-joined URL filter value into trimmed, non-empty values.
 * An empty value yields an empty list, which means "all values".
 */
export function parseFilterValues(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Join selected values into the comma-joined value stored in the URL. */
export function joinFilterValues(values: string[]): string {
  return values.join(",")
}

/**
 * Convert the search query and URL filter values into the `CrudFilter[]` that
 * `@refinedev/core`'s `useList` understands. Empty values are skipped.
 *
 * The Due date URL keys stay date-only, but the API compares UTC instants:
 * a From bound becomes the start of the selected local day and a To bound
 * becomes the end of the selected local day.
 */
export function toCrudFilters(q: string, filters: TaskFilters): CrudFilter[] {
  const result: CrudFilter[] = []
  if (q) result.push({ field: "q", operator: "contains", value: q })
  const statuses = parseFilterValues(filters.status)
  const onlyStatus = statuses[0]
  if (statuses.length > 1) {
    result.push({ field: "status", operator: "in", value: statuses })
  } else if (onlyStatus) {
    result.push({ field: "status", operator: "eq", value: onlyStatus })
  }
  const priorities = parseFilterValues(filters.priority)
  const onlyPriority = priorities[0]
  if (priorities.length > 1) {
    result.push({ field: "priority", operator: "in", value: priorities })
  } else if (onlyPriority) {
    result.push({ field: "priority", operator: "eq", value: onlyPriority })
  }
  const assignees = parseFilterValues(filters.assignee)
  const onlyAssignee = assignees[0]
  if (assignees.length > 1) {
    result.push({ field: "assigneeId", operator: "in", value: assignees })
  } else if (onlyAssignee) {
    result.push({ field: "assigneeId", operator: "eq", value: onlyAssignee })
  }
  if (dateOnlyToLocalDate(filters.dueFrom))
    result.push({
      field: "dueDate",
      operator: "gte",
      value: localStartOfDayUtcInstant(filters.dueFrom),
    })
  if (dateOnlyToLocalDate(filters.dueTo))
    result.push({
      field: "dueDate",
      operator: "lte",
      value: localEndOfDayUtcInstant(filters.dueTo),
    })
  return result
}
