import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { RoleRecord } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"

import { RolesBulkEditSheet } from "@/features/roles/components/roles-bulk-edit-sheet"
import { useRolesBulkActions } from "@/features/roles/hooks/use-roles-bulk-actions"

/**
 * The administrator-only bar above the Roles table. It appears once rows are
 * selected, reports the page-scoped selection count, and exposes the two bulk
 * actions. The forms and mutations live in their own files so this bar stays a
 * thin layout surface.
 */
export function RolesBulkBar({
  selectedRoles,
  onDone,
}: {
  selectedRoles: RoleRecord[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [editOpen, setEditOpen] = useState(false)
  // Remounting the form for each session discards draft values without an
  // effect that resets state on open.
  const [editSession, setEditSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { bulkUpdate, bulkDelete, isApplying } = useRolesBulkActions({
    selected: selectedRoles,
    onDone: () => {
      setEditOpen(false)
      setDeleteOpen(false)
      onDone()
    },
  })

  return (
    <>
      <div
        role="region"
        aria-label={t("roles.bulk.actions")}
        className="flex animate-fade-in flex-wrap items-center gap-2 border border-border bg-muted/40 px-3 py-2"
      >
        <span className="font-medium">
          {t("roles.bulk.selected", { count: selectedRoles.length })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditSession((session) => session + 1)
              setEditOpen(true)
            }}
          >
            {t("roles.bulk.edit")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            {t("roles.bulk.delete")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (isApplying) return
          setDeleteOpen(false)
        }}
        title={t("roles.bulk.deleteTitle", {
          count: selectedRoles.length,
        })}
        description={t("roles.bulk.deleteDescription")}
        confirmLabel={t("roles.bulk.deleteConfirm")}
        cancelLabel={t("common.cancel")}
        loading={isApplying}
        onConfirm={() => bulkDelete({ onSettled: () => setDeleteOpen(false) })}
        tone="destructive"
      />

      <RolesBulkEditSheet
        key={editSession}
        open={editOpen}
        onOpenChange={(open) => {
          if (!open && isApplying) return
          setEditOpen(open)
        }}
        selectedCount={selectedRoles.length}
        onApply={(patch) => {
          bulkUpdate(patch, {
            onSettled: () => setEditOpen(false),
          })
        }}
        isApplying={isApplying}
      />
    </>
  )
}
