import type { TFunction } from "i18next"
import {
  taskPrioritySchema,
  taskStatusSchema,
  type TaskPriority,
  type TaskStatus,
} from "@workspace/api/schemas"
import {
  createTableUrlAdapter,
  type EnumOption,
  type TableUrlState,
} from "@workspace/shared-lib/hooks"
import {
  dateRangeText,
  filterValueLabels,
  type DateRangeTextCopy,
  type TableFilterDescriptor,
} from "@workspace/shared-lib/utils"

import type { TaskFilterKey, TaskFilterValues } from "./filters"

/** Default sort, matching the table's designed order. */
export const TASKS_DEFAULT_SORT_FIELD = "title"
export const TASKS_DEFAULT_SORT_ORDER = "asc"

/** Feature-supplied copy and option labels for the Tasks filter chips. */
export type TaskChipContext = {
  t: TFunction<"translation">
  statusOptions: readonly EnumOption<TaskStatus>[]
  priorityOptions: readonly EnumOption<TaskPriority>[]
  assigneeOptions: readonly { value: string; label: string }[]
}

function taskDateRangeCopy(t: TaskChipContext["t"]): DateRangeTextCopy {
  return {
    range: (from, to) => t("tasks.filters.dateRange", { from, to }),
    from: (date) => t("tasks.filters.dateFrom", { date }),
    until: (date) => t("tasks.filters.dateUntil", { date }),
  }
}

/**
 * The flat URL format for the Tasks table and the bar-direction conversion,
 * declared once per filter. Keys match the pre-Refine table so existing deep
 * links keep working.
 */
export const TASK_FILTER_DESCRIPTORS: readonly TableFilterDescriptor<
  TaskFilterValues,
  TaskFilterKey,
  TaskChipContext
>[] = [
  {
    kind: "text",
    param: "q",
    field: "q",
    key: "q",
    chip: (values, { t }) => t("tasks.filters.chipSearch", { value: values.q }),
  },
  {
    kind: "enumMulti",
    param: "status",
    field: "status",
    values: taskStatusSchema.options,
    key: "status",
    chip: (values, { t, statusOptions }) =>
      t("tasks.filters.chipStatus", {
        value: filterValueLabels(values.status, statusOptions),
      }),
  },
  {
    kind: "enumMulti",
    param: "priority",
    field: "priority",
    values: taskPrioritySchema.options,
    key: "priority",
    chip: (values, { t, priorityOptions }) =>
      t("tasks.filters.chipPriority", {
        value: filterValueLabels(values.priority, priorityOptions),
      }),
  },
  {
    // Assignee ids are open-ended; `unassigned` is a sentinel, not an enum.
    kind: "enumMulti",
    param: "assignee",
    field: "assigneeId",
    key: "assignee",
    chip: (values, { t, assigneeOptions }) =>
      t("tasks.filters.chipAssignee", {
        value: filterValueLabels(values.assignee, assigneeOptions),
      }),
  },
  {
    kind: "dateRange",
    fromParam: "dueFrom",
    toParam: "dueTo",
    field: "dueDate",
    key: "dueDate",
    chip: (values, { t }) =>
      t("tasks.filters.chipDueDate", {
        value: dateRangeText(
          values.dueFrom,
          values.dueTo,
          taskDateRangeCopy(t)
        ),
      }),
  },
]

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
  filters: TASK_FILTER_DESCRIPTORS,
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
