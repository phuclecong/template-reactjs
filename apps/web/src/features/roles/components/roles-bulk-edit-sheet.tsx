import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { RoleStatus } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  ComboboxFilter,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { useEnums } from "@workspace/shared-lib/hooks"

import type { RoleBulkPatch } from "@/features/roles/hooks/use-roles-bulk-actions"
import {
  createRoleBulkFormSchema,
  normalizeRoleDescription,
} from "@/features/roles/utils/role-schema"

type StatusChoice = RoleStatus | ""

/**
 * Bulk edit form. Titles are excluded because they are unique. The form tracks
 * which fields the Administrator actually touched so the payload carries only
 * dirty fields; a description cleared to empty is sent as `null`.
 */
export function RolesBulkEditSheet({
  open,
  onOpenChange,
  selectedCount,
  onApply,
  isApplying,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onApply: (patch: RoleBulkPatch) => void
  isApplying: boolean
}) {
  const { t } = useTranslation()
  const { ROLE_STATUS_OPTIONS: statusOptions } = useEnums()
  const schema = useMemo(
    () =>
      createRoleBulkFormSchema({
        titleRequired: t("roles.validation.titleRequired"),
        titleTooLong: t("roles.validation.titleTooLong"),
        descriptionTooLong: t("roles.validation.descriptionTooLong"),
      }),
    [t]
  )
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<StatusChoice>("")
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [statusTouched, setStatusTouched] = useState(false)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)

  // Empty string is the "unchanged" sentinel, so it doubles as the option that
  // lets the Administrator revert a touched status field.
  const statusChoices = useMemo<FilterOption[]>(
    () => [
      { value: "", label: t("roles.bulk.statusUnchanged") },
      ...statusOptions,
    ],
    [statusOptions, t]
  )

  const hasChanges = descriptionTouched || statusTouched

  const handleApply = () => {
    if (!hasChanges || isApplying) return
    const parsed = schema.safeParse({ description, status })
    if (!parsed.success) {
      const descriptionIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === "description"
      )
      setDescriptionError(
        descriptionIssue?.message ?? t("roles.validation.descriptionTooLong")
      )
      return
    }

    setDescriptionError(null)
    const patch: RoleBulkPatch = {}
    if (descriptionTouched) {
      patch.description = normalizeRoleDescription(parsed.data.description)
    }
    if (statusTouched && parsed.data.status !== "") {
      patch.status = parsed.data.status
    }
    onApply(patch)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {t("roles.bulk.editTitle", { count: selectedCount })}
          </SheetTitle>
          <SheetDescription>{t("roles.bulk.editDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="roles-bulk-description">
                {t("roles.bulk.description")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDescription("")
                  setDescriptionTouched(true)
                  setDescriptionError(null)
                }}
              >
                {t("roles.bulk.clearDescription")}
              </Button>
            </div>
            <Textarea
              id="roles-bulk-description"
              value={description}
              placeholder={t("roles.bulk.descriptionPlaceholder")}
              aria-invalid={descriptionError !== null}
              onChange={(event) => {
                setDescription(event.target.value)
                setDescriptionTouched(true)
                if (descriptionError) setDescriptionError(null)
              }}
            />
            {descriptionError ? (
              <p role="alert" className="text-xs text-destructive">
                {descriptionError}
              </p>
            ) : descriptionTouched &&
              normalizeRoleDescription(description) === null ? (
              <p className="text-xs text-muted-foreground">
                {t("roles.bulk.descriptionWillClear")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="roles-bulk-status">{t("roles.bulk.status")}</Label>
            <ComboboxFilter
              id="roles-bulk-status"
              multiple={false}
              options={statusChoices}
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusChoice)
                setStatusTouched(value !== "")
              }}
              ariaLabel={t("roles.bulk.status")}
              placeholder={t("roles.bulk.status")}
              className="w-full"
              disabled={isApplying}
              showClear={false}
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!hasChanges || isApplying}
          >
            {t("roles.bulk.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
