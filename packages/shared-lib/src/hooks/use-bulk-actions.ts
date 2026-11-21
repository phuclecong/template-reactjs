import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  useCustomMutation,
  useInvalidate,
  type HttpError,
} from "@refinedev/core"

/** A row the lifecycle can name in failure copy. */
export type BulkTarget = { id: string; title: string }

/** One per-row failure from a bulk endpoint. */
export type BulkFailure = { id: string; reason: string }

export type BulkActionOptions = {
  /** Runs once the mutation finishes, whether it succeeds or fails. */
  onSettled?: () => void
}

type BulkMethod = "patch" | "post" | "put" | "delete"

export type BulkActionConfig<TTarget extends BulkTarget, TPatch> = {
  /**
   * The already-gated selection. Selection gating is not this hook's job: the
   * feature's `useTableShell` `enableRowSelection` owns the boolean/predicate
   * rule, so the lifecycle only ever sees rows the user may act on.
   */
  selected: TTarget[]
  /** Refine resource invalidated after success, e.g. `"roles"`. */
  resource: string
  /** Analytics event name, e.g. `"role.bulk_action"`. */
  event: string
  /** Translation namespace, e.g. `"roles.bulk"`. */
  keyPrefix: string
  /** Known failure reasons; anything else is rendered raw. */
  reasons: readonly string[]
  /** Injected so shared-lib carries no app dependency. */
  track: (event: string, data?: Record<string, unknown>) => void
  /** Injected so shared-lib carries no app dependency. */
  describeError: (error: unknown) => string | undefined
  /** Clears the selection after a successful write. */
  onDone: () => void
  update: {
    url: string
    method?: BulkMethod
    /** Defaults to `{ ids, ...patch }`. */
    values?: (ids: string[], patch: TPatch) => Record<string, unknown>
    /** Extra analytics fields, e.g. Tasks' changed `fields`. */
    trackData?: (patch: TPatch) => Record<string, unknown>
  }
  delete?: {
    url: string
    method?: BulkMethod
    /** Defaults to `{ ids }`. */
    values?: (ids: string[]) => Record<string, unknown>
  }
}

export type BulkActions<TPatch> = {
  bulkUpdate: (patch: TPatch, options?: BulkActionOptions) => void
  bulkDelete?: (options?: BulkActionOptions) => void
  isApplying: boolean
}

type BulkResponse = {
  updated?: number
  deleted?: number
  failed?: BulkFailure[]
}

/**
 * The write lifecycle shared by the Roles and Tasks bulk action bars: guard,
 * mutate, notify (including per-row failures), track, clear the selection, and
 * invalidate the list.
 *
 * **Selection gating is not here.** `useTableShell`'s `enableRowSelection`
 * already owns the boolean-vs-predicate rule (Roles: a permission; Tasks:
 * `canModifyTask`); this hook consumes the resulting gated `selected` list.
 *
 * **Why not `useUpdateMany` / `useDeleteMany`?** The `simple-rest` data
 * provider omits `updateMany`/`deleteMany`, so those hooks cannot issue the
 * bulk requests (ADR-0015). The lifecycle therefore composes two existing
 * Refine hooks instead of replacing them: `useCustomMutation` performs the
 * request through the provider's `custom` method (Refine owns fetching, retry,
 * and notification dispatch), and `useInvalidate` invalidates the list, which
 * `useCustomMutation` deliberately does not do on its own.
 */
export function useBulkActions<TTarget extends BulkTarget, TPatch>(
  config: BulkActionConfig<TTarget, TPatch> & {
    delete: NonNullable<BulkActionConfig<TTarget, TPatch>["delete"]>
  }
): BulkActions<TPatch> & {
  bulkDelete: (options?: BulkActionOptions) => void
}
export function useBulkActions<TTarget extends BulkTarget, TPatch>(
  config: BulkActionConfig<TTarget, TPatch>
): BulkActions<TPatch> & { bulkDelete?: undefined }
export function useBulkActions<TTarget extends BulkTarget, TPatch>(
  config: BulkActionConfig<TTarget, TPatch>
): BulkActions<TPatch> {
  const { t } = useTranslation()
  const invalidate = useInvalidate()
  const updateMutation = useCustomMutation<
    BulkResponse,
    HttpError,
    Record<string, unknown>
  >({})
  const deleteMutation = useCustomMutation<
    BulkResponse,
    HttpError,
    Record<string, unknown>
  >({})

  const {
    selected,
    resource,
    event,
    keyPrefix,
    reasons,
    update,
    delete: deleteConfig,
    track,
    describeError,
    onDone,
  } = config

  const titlesById = useMemo(
    () => new Map(selected.map((target) => [target.id, target.title])),
    [selected]
  )
  const knownReasons = useMemo(() => new Set(reasons), [reasons])

  const failuresDescription = useCallback(
    (failed: BulkFailure[]) =>
      failed
        .map((failure) => {
          const reason = knownReasons.has(failure.reason)
            ? t(`${keyPrefix}.reasons.${failure.reason}`)
            : failure.reason
          return t(`${keyPrefix}.failureRow`, {
            title: titlesById.get(failure.id) ?? failure.id,
            reason,
          })
        })
        .join("; "),
    [knownReasons, t, keyPrefix, titlesById]
  )

  const bulkUpdate = useCallback(
    (patch: TPatch, options?: BulkActionOptions) => {
      if (selected.length === 0) return
      const ids = selected.map((target) => target.id)
      const values = update.values
        ? update.values(ids, patch)
        : ({ ids, ...patch } as Record<string, unknown>)

      updateMutation.mutate(
        {
          url: update.url,
          method: update.method ?? "patch",
          values,
          successNotification: (data) => {
            const result = data?.data
            const failed = result?.failed ?? []
            if (failed.length > 0) {
              return {
                message: t(`${keyPrefix}.updatedWithFailures`, {
                  updated: result?.updated ?? 0,
                  failed: failed.length,
                }),
                description: failuresDescription(failed),
                type: "error" as const,
              }
            }
            return {
              message: t(`${keyPrefix}.updated`, {
                count: result?.updated ?? 0,
              }),
              type: "success" as const,
            }
          },
          errorNotification: (error) => ({
            message: t(`${keyPrefix}.failed`),
            description: describeError(error),
            type: "error" as const,
          }),
        },
        {
          onSuccess: (data) => {
            const result = data?.data
            track(event, {
              action: "update",
              ...update.trackData?.(patch),
              selected: selected.length,
              updated: result?.updated ?? 0,
              failed: result?.failed?.length ?? 0,
            })
            onDone()
            void invalidate({ resource, invalidates: ["list"] })
          },
          onSettled: () => options?.onSettled?.(),
        }
      )
    },
    [
      selected,
      update,
      updateMutation,
      t,
      keyPrefix,
      event,
      track,
      onDone,
      resource,
      invalidate,
      failuresDescription,
      describeError,
    ]
  )

  const bulkDelete = useCallback(
    (options?: BulkActionOptions) => {
      if (!deleteConfig || selected.length === 0) return
      const ids = selected.map((target) => target.id)
      const values = deleteConfig.values
        ? deleteConfig.values(ids)
        : ({ ids } as Record<string, unknown>)

      deleteMutation.mutate(
        {
          url: deleteConfig.url,
          method: deleteConfig.method ?? "post",
          values,
          successNotification: (data) => {
            const result = data?.data
            const failed = result?.failed ?? []
            if (failed.length > 0) {
              return {
                message: t(`${keyPrefix}.deletedWithFailures`, {
                  deleted: result?.deleted ?? 0,
                  failed: failed.length,
                }),
                description: failuresDescription(failed),
                type: "error" as const,
              }
            }
            return {
              message: t(`${keyPrefix}.deleted`, {
                count: result?.deleted ?? 0,
              }),
              type: "success" as const,
            }
          },
          errorNotification: (error) => ({
            message: t(`${keyPrefix}.failed`),
            description: describeError(error),
            type: "error" as const,
          }),
        },
        {
          onSuccess: (data) => {
            const result = data?.data
            track(event, {
              action: "delete",
              selected: selected.length,
              deleted: result?.deleted ?? 0,
              failed: result?.failed?.length ?? 0,
            })
            onDone()
            void invalidate({ resource, invalidates: ["list"] })
          },
          onSettled: () => options?.onSettled?.(),
        }
      )
    },
    [
      deleteConfig,
      selected,
      deleteMutation,
      t,
      keyPrefix,
      failuresDescription,
      describeError,
      track,
      event,
      onDone,
      resource,
      invalidate,
    ]
  )

  return {
    bulkUpdate,
    bulkDelete: deleteConfig ? bulkDelete : undefined,
    isApplying:
      updateMutation.mutation.isPending ||
      (deleteConfig !== undefined && deleteMutation.mutation.isPending),
  }
}
