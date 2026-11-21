import type { components } from "@workspace/api/contract"
import { useBulkActions } from "@workspace/shared-lib/hooks"
import { track } from "@/observability"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

type BulkUpdateRequest = components["schemas"]["TaskBulkUpdateRequest"]

/** The fields a bulk edit may change. Ids are added by the hook. */
export type TaskBulkPatch = Omit<BulkUpdateRequest, "ids">

type SelectedTask = { id: string; title: string }

/**
 * Analytics names for the patch keys. The event reports which fields the sheet
 * changed instead of the old one-action-per-event shape.
 */
const FIELD_NAMES = {
  status: "status",
  priority: "priority",
  assigneeId: "assignee",
  dueDate: "due_date",
} as const

function patchFields(patch: TaskBulkPatch): string[] {
  return (Object.keys(patch) as Array<keyof typeof FIELD_NAMES>).map(
    (key) => FIELD_NAMES[key]
  )
}

/** The API types `BulkFailure.reason` as a string; only these are translated. */
const TASK_BULK_FAILURE_REASONS = ["not_found", "forbidden"] as const

/**
 * Write path for the Tasks bulk-edit sheet: apply every dirty field in one
 * PATCH to `/tasks/bulk`, report per-row failures by task title, then
 * invalidate the list. `onDone` clears the selection after success. Tasks have
 * no bulk delete, so the shared lifecycle exposes only `bulkUpdate`.
 *
 * The shared module composes Refine's `useCustomMutation` / `useInvalidate`
 * rather than `useUpdateMany`: the `simple-rest` data provider has no
 * `updateMany`, so the bulk request goes through the provider's `custom` method
 * and the list invalidation is issued explicitly (ADR-0015).
 */
export function useTaskBulkActions({
  selected,
  onDone,
}: {
  selected: SelectedTask[]
  onDone: () => void
}) {
  const { bulkUpdate, isApplying } = useBulkActions<
    SelectedTask,
    TaskBulkPatch
  >({
    selected,
    resource: "tasks",
    event: "task.bulk_action",
    keyPrefix: "tasks.bulk",
    reasons: TASK_BULK_FAILURE_REASONS,
    track,
    describeError,
    onDone,
    update: {
      url: `${apiUrl}/tasks/bulk`,
      trackData: (patch) => ({ fields: patchFields(patch) }),
    },
  })

  return { bulkUpdate, isApplying }
}
