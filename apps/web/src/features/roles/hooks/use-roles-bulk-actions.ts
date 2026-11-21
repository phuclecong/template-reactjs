import { useBulkActions } from "@workspace/shared-lib/hooks"
import type { components } from "@workspace/api/contract"
import { track } from "@/observability"
import { apiUrl } from "@/utils/api-url"
import { describeError } from "@/utils/http-error"

type RoleBulkFailure = components["schemas"]["RoleBulkFailure"]

/** The fields a bulk edit may change. Titles are never sent. */
export type RoleBulkPatch = Omit<
  components["schemas"]["RoleBulkUpdateRequest"],
  "ids"
>

type SelectedRole = { id: string; title: string }

/** Known failure reasons; the shared lifecycle translates these and shows anything else raw. */
const ROLE_BULK_REASONS: readonly RoleBulkFailure["reason"][] = [
  "not_found",
  "system_role",
  "referenced",
  "validation",
]

/**
 * Write path for Roles bulk actions, configured on the shared bulk-action
 * lifecycle. Every confirmed action clears the selection (`onDone`) and emits
 * a counts-only business event.
 *
 * The shared module composes Refine's `useCustomMutation` and `useInvalidate`
 * rather than `useUpdateMany`/`useDeleteMany`: the `simple-rest` data provider
 * omits `updateMany`/`deleteMany`, so those hooks cannot issue the bulk requests
 * (ADR-0015). Selection gating stays in `useTableShell`; this hook consumes the
 * already-gated `selected` rows.
 */
export function useRolesBulkActions({
  selected,
  onDone,
}: {
  selected: SelectedRole[]
  onDone: () => void
}) {
  return useBulkActions<SelectedRole, RoleBulkPatch>({
    selected,
    resource: "roles",
    event: "role.bulk_action",
    keyPrefix: "roles.bulk",
    reasons: ROLE_BULK_REASONS,
    track,
    describeError,
    onDone,
    update: { url: `${apiUrl}/roles/bulk` },
    delete: { url: `${apiUrl}/roles/bulk-delete` },
  })
}
