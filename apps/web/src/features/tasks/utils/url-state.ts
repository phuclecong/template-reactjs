import { taskPrioritySchema, taskStatusSchema } from "@workspace/api/schemas"
import {
  createTableUrlAdapter,
  type TableUrlState,
} from "@workspace/shared-lib/hooks"

/** Default sort, matching the table's designed order. */
export const TASKS_DEFAULT_SORT_FIELD = "title"
export const TASKS_DEFAULT_SORT_ORDER = "asc"

/**
 * The flat URL format for the Tasks table. Keys match the pre-Refine table so
 * existing deep links keep working; the encoding rules live in the shared
 * adapter (see `roles/utils/url-state.ts` for the other consumer).
 */
const adapter = createTableUrlAdapter({
  defaultSortField: TASKS_DEFAULT_SORT_FIELD,
  defaultSortOrder: TASKS_DEFAULT_SORT_ORDER,
  sortableFields: ["title", "status", "priority", "dueDate"],
  ownedParams: [
    "q",
    "status",
    "priority",
    "assignee",
    "dueFrom",
    "dueTo",
    "sort",
    "order",
    "page",
    "pageSize",
  ],
  filters: [
    { kind: "text", param: "q", field: "q" },
    {
      kind: "enumMulti",
      param: "status",
      field: "status",
      values: taskStatusSchema.options,
    },
    {
      kind: "enumMulti",
      param: "priority",
      field: "priority",
      values: taskPrioritySchema.options,
    },
    // Assignee ids are open-ended; `unassigned` is a sentinel, not an enum.
    { kind: "enumMulti", param: "assignee", field: "assigneeId" },
    {
      kind: "dateRange",
      fromParam: "dueFrom",
      toParam: "dueTo",
      field: "dueDate",
    },
  ],
})

/** The table state the URL represents: the same shape Refine's `useTable` holds. */
export type TasksUrlState = TableUrlState

/** Parses flat query parameters into Refine table state. */
export function parseTasksUrlState(params: URLSearchParams): TasksUrlState {
  return adapter.parse(params)
}

/**
 * Writes table state as flat, URL-encoded query parameters, preserving any
 * parameters the table does not own.
 */
export function buildTasksSearchParams(
  state: TasksUrlState,
  current: URLSearchParams
): URLSearchParams {
  return adapter.build(state, current)
}
