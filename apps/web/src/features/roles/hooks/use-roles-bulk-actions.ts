import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useInvalidate,
  type HttpError,
} from "@refinedev/core"
import type { RoleStatus } from "@workspace/api/schemas"
import { track } from "@/observability"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

/** The fields a bulk edit may change. Titles are never sent. */
export type RoleBulkPatch = {
  description?: string | null
  status?: RoleStatus
}

export type RoleBulkFailure = {
  id: string
  reason: "not_found" | "referenced" | "system_role" | "validation"
}

export type RoleBulkUpdateResponse = {
  updated: number
  failed: RoleBulkFailure[]
}

export type RoleBulkDeleteResponse = {
  deleted: number
  failed: RoleBulkFailure[]
}

type SelectedRole = { id: string; title: string }
type BulkUpdateRequest = { ids: string[] } & RoleBulkPatch

type ApplyOptions = {
  /** Runs once the mutation finishes, whether it succeeds or fails. */
  onSettled?: () => void
}

/**
 * Write path for Roles bulk actions. `simple-rest` has no `updateMany`, so
 * both calls go through `useCustomMutation` and invalidate the Roles list
 * explicitly. Every confirmed action clears the selection (`onDone`) and emits
 * a counts-only business event.
 */
export function useRolesBulkActions({
  selected,
  onDone,
}: {
  selected: SelectedRole[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const invalidate = useInvalidate()
  const updateMutation = useCustomMutation<
    RoleBulkUpdateResponse,
    HttpError,
    BulkUpdateRequest
  >({})
  const deleteMutation = useCustomMutation<
    RoleBulkDeleteResponse,
    HttpError,
    { ids: string[] }
  >({})

  const selectedIds = selected.map((role) => role.id)
  const selectedCount = selected.length

  const failuresDescription = useCallback(
    (failed: RoleBulkFailure[]) => {
      const titles = new Map(selected.map((role) => [role.id, role.title]))
      return failed
        .map((failure) =>
          t("roles.bulk.failureRow", {
            title: titles.get(failure.id) ?? failure.id,
            reason: t(`roles.bulk.reasons.${failure.reason}`),
          })
        )
        .join("; ")
    },
    [selected, t]
  )

  const bulkUpdate = useCallback(
    (patch: RoleBulkPatch, options?: ApplyOptions) => {
      if (selectedCount === 0) return
      updateMutation.mutate(
        {
          url: `${apiUrl}/roles/bulk`,
          method: "patch",
          values: { ids: selectedIds, ...patch },
          successNotification: (data) => {
            const result = data?.data
            const failed = result?.failed ?? []
            if (failed.length > 0) {
              return {
                message: t("roles.bulk.updatedWithFailures", {
                  updated: result?.updated ?? 0,
                  failed: failed.length,
                }),
                description: failuresDescription(failed),
                type: "error" as const,
              }
            }
            return {
              message: t("roles.bulk.updated", {
                count: result?.updated ?? 0,
              }),
              type: "success" as const,
            }
          },
          errorNotification: (error) => ({
            message: t("roles.bulk.failed"),
            description: describeError(error),
            type: "error" as const,
          }),
        },
        {
          onSuccess: (data) => {
            const result = data?.data
            track("role.bulk_action", {
              action: "update",
              selected: selectedCount,
              updated: result?.updated ?? 0,
              failed: result?.failed?.length ?? 0,
            })
            onDone()
            void invalidate({ resource: "roles", invalidates: ["list"] })
          },
          onSettled: () => options?.onSettled?.(),
        }
      )
    },
    [
      selectedCount,
      selectedIds,
      updateMutation,
      t,
      failuresDescription,
      onDone,
      invalidate,
    ]
  )

  const bulkDelete = useCallback(
    (options?: ApplyOptions) => {
      if (selectedCount === 0) return
      deleteMutation.mutate(
        {
          url: `${apiUrl}/roles/bulk-delete`,
          method: "post",
          values: { ids: selectedIds },
          successNotification: (data) => {
            const result = data?.data
            const failed = result?.failed ?? []
            if (failed.length > 0) {
              return {
                message: t("roles.bulk.deletedWithFailures", {
                  deleted: result?.deleted ?? 0,
                  failed: failed.length,
                }),
                description: failuresDescription(failed),
                type: "error" as const,
              }
            }
            return {
              message: t("roles.bulk.deleted", {
                count: result?.deleted ?? 0,
              }),
              type: "success" as const,
            }
          },
          errorNotification: (error) => ({
            message: t("roles.bulk.failed"),
            description: describeError(error),
            type: "error" as const,
          }),
        },
        {
          onSuccess: (data) => {
            const result = data?.data
            track("role.bulk_action", {
              action: "delete",
              selected: selectedCount,
              deleted: result?.deleted ?? 0,
              failed: result?.failed?.length ?? 0,
            })
            onDone()
            void invalidate({ resource: "roles", invalidates: ["list"] })
          },
          onSettled: () => options?.onSettled?.(),
        }
      )
    },
    [
      selectedCount,
      selectedIds,
      deleteMutation,
      t,
      failuresDescription,
      onDone,
      invalidate,
    ]
  )

  return {
    bulkUpdate,
    bulkDelete,
    isApplying:
      updateMutation.mutation.isPending || deleteMutation.mutation.isPending,
  }
}
