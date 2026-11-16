import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useInvalidate,
  type HttpError,
} from "@refinedev/core"
import type { TaskPriority, TaskStatus } from "@/features/tasks/utils"
import { track } from "@/observability"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

type BulkPatch = {
  status?: TaskStatus
  priority?: TaskPriority | null
  assigneeId?: string | null
  dueDate?: string | null
}

type BulkUpdateRequest = { ids: string[] } & BulkPatch

type BulkUpdateResponse = {
  updated: number
  failed: { id: string; reason: string }[]
}

type ApplyBulkOptions = {
  /** Runs once the mutation finishes, whether it succeeds or fails. */
  onSettled?: () => void
}

type BulkActionName = "status" | "priority" | "assignee" | "due_date"

/**
 * The bulk action an event reports: the single field the patch changes.
 * An empty patch names no action, so it emits no event.
 */
function bulkActionName(patch: BulkPatch): BulkActionName | undefined {
  if ("status" in patch) return "status"
  if ("priority" in patch) return "priority"
  if ("assigneeId" in patch) return "assignee"
  if ("dueDate" in patch) return "due_date"
  return undefined
}

/**
 * Write path for bulk task updates: apply a Status/Priority/Assignee patch to
 * the selected tasks via the tasks bulk endpoint, then invalidate the task
 * list. `onDone` runs after a successful update so the caller can clear the
 * selection; every confirmed action, including a Due-date set, completes here.
 */
export function useTaskBulkActions({
  selectedIds,
  onDone,
}: {
  selectedIds: string[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const invalidate = useInvalidate()
  const bulkMutation = useCustomMutation<
    BulkUpdateResponse,
    HttpError,
    BulkUpdateRequest
  >({})

  const applyBulk = useCallback(
    (patch: BulkPatch, options?: ApplyBulkOptions) => {
      if (selectedIds.length === 0) return
      const action = bulkActionName(patch)
      bulkMutation.mutate(
        {
          url: `${apiUrl}/tasks/bulk`,
          method: "patch",
          values: { ids: selectedIds, ...patch },
          successNotification: (data) => {
            const result = data?.data
            const failed = result?.failed?.length ?? 0
            if (failed > 0) {
              return {
                message: t("tasks.bulk.updatedWithFailures", {
                  updated: result?.updated ?? 0,
                  failed,
                }),
                type: "error" as const,
              }
            }
            return {
              message: t("tasks.bulk.updated", { count: result?.updated ?? 0 }),
              type: "success" as const,
            }
          },
          errorNotification: (error) => ({
            message: t("tasks.bulk.failed"),
            type: "error" as const,
            description: describeError(error),
          }),
        },
        {
          onSuccess: (data) => {
            const result = data?.data
            if (action !== undefined) {
              track("task.bulk_action", {
                action,
                selected: selectedIds.length,
                updated: result?.updated ?? 0,
                failed: result?.failed?.length ?? 0,
              })
            }
            onDone()
            void invalidate({ resource: "tasks", invalidates: ["list"] })
          },
          onSettled: () => options?.onSettled?.(),
        }
      )
    },
    [selectedIds, bulkMutation, invalidate, onDone, t]
  )

  return { applyBulk, isApplying: bulkMutation.mutation.isPending }
}
