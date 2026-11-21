import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useInvalidate,
  type HttpError,
} from "@refinedev/core"
import type { components } from "@workspace/api/contract"
import { track } from "@/observability"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

type BulkUpdateRequest = components["schemas"]["TaskBulkUpdateRequest"]
type BulkUpdateResponse = components["schemas"]["TaskBulkUpdateResponse"]
type TaskBulkFailure = components["schemas"]["BulkFailure"]

/** The fields a bulk edit may change. Ids are added by the hook. */
export type TaskBulkPatch = Omit<BulkUpdateRequest, "ids">

type SelectedTask = { id: string; title: string }

type ApplyOptions = {
  /** Runs once the mutation finishes, whether it succeeds or fails. */
  onSettled?: () => void
}

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

/**
 * Write path for the Tasks bulk-edit sheet: apply every dirty field in one
 * PATCH to `/tasks/bulk`, report per-row failures by task title, then
 * invalidate the list. `onDone` clears the selection after success.
 */
export function useTaskBulkActions({
  selected,
  onDone,
}: {
  selected: SelectedTask[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const invalidate = useInvalidate()
  const bulkMutation = useCustomMutation<
    BulkUpdateResponse,
    HttpError,
    BulkUpdateRequest
  >({})

  const selectedIds = selected.map((task) => task.id)
  const selectedCount = selected.length

  const failuresDescription = useCallback(
    (failed: TaskBulkFailure[]) => {
      const titles = new Map(selected.map((task) => [task.id, task.title]))
      return failed
        .map((failure) =>
          t("tasks.bulk.failureRow", {
            title: titles.get(failure.id) ?? failure.id,
            reason: t(`tasks.bulk.reasons.${failure.reason}`),
          })
        )
        .join("; ")
    },
    [selected, t]
  )

  const bulkUpdate = useCallback(
    (patch: TaskBulkPatch, options?: ApplyOptions) => {
      if (selectedCount === 0) return
      const fields = patchFields(patch)

      bulkMutation.mutate(
        {
          url: `${apiUrl}/tasks/bulk`,
          method: "patch",
          values: { ids: selectedIds, ...patch },
          successNotification: (data) => {
            const result = data?.data
            const failed = result?.failed ?? []
            if (failed.length > 0) {
              return {
                message: t("tasks.bulk.updatedWithFailures", {
                  updated: result?.updated ?? 0,
                  failed: failed.length,
                }),
                description: failuresDescription(failed),
                type: "error" as const,
              }
            }
            return {
              message: t("tasks.bulk.updated", {
                count: result?.updated ?? 0,
              }),
              type: "success" as const,
            }
          },
          errorNotification: (error) => ({
            message: t("tasks.bulk.failed"),
            description: describeError(error),
            type: "error" as const,
          }),
        },
        {
          onSuccess: (data) => {
            const result = data?.data
            track("task.bulk_action", {
              action: "update",
              fields,
              selected: selectedCount,
              updated: result?.updated ?? 0,
              failed: result?.failed?.length ?? 0,
            })
            onDone()
            void invalidate({ resource: "tasks", invalidates: ["list"] })
          },
          onSettled: () => options?.onSettled?.(),
        }
      )
    },
    [
      selectedCount,
      selectedIds,
      bulkMutation,
      t,
      failuresDescription,
      onDone,
      invalidate,
    ]
  )

  return { bulkUpdate, isApplying: bulkMutation.mutation.isPending }
}
