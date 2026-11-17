import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { RoleStatus } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"

import type { RoleBulkPatch } from "@/features/roles/hooks/use-roles-bulk-actions"

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
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<StatusChoice>("")
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [statusTouched, setStatusTouched] = useState(false)

  const hasChanges = descriptionTouched || statusTouched

  const handleApply = () => {
    if (!hasChanges || isApplying) return
    const patch: RoleBulkPatch = {}
    if (descriptionTouched) {
      const trimmed = description.trim()
      patch.description = trimmed === "" ? null : trimmed
    }
    if (statusTouched) patch.status = status as RoleStatus
    onApply(patch)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {t("roles.bulk.editTitle", { count: selectedCount })}
          </SheetTitle>
          <SheetDescription>
            {t("roles.bulk.editDescription")}
          </SheetDescription>
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
                }}
              >
                {t("roles.bulk.clearDescription")}
              </Button>
            </div>
            <Textarea
              id="roles-bulk-description"
              value={description}
              maxLength={500}
              placeholder={t("roles.bulk.descriptionPlaceholder")}
              onChange={(event) => {
                setDescription(event.target.value)
                setDescriptionTouched(true)
              }}
            />
            {descriptionTouched && description.trim() === "" ? (
              <p className="text-xs text-muted-foreground">
                {t("roles.bulk.descriptionWillClear")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="roles-bulk-status">
              {t("roles.bulk.status")}
            </Label>
            <Select
              value={status || "unchanged"}
              onValueChange={(value) => {
                setStatus(value === "unchanged" ? "" : (value as RoleStatus))
                setStatusTouched(value !== "unchanged")
              }}
            >
              <SelectTrigger
                id="roles-bulk-status"
                size="sm"
                aria-label={t("roles.bulk.status")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">
                  {t("roles.bulk.statusUnchanged")}
                </SelectItem>
                <SelectItem value="active">
                  {t("roles.filters.statusActive")}
                </SelectItem>
                <SelectItem value="inactive">
                  {t("roles.filters.statusInactive")}
                </SelectItem>
              </SelectContent>
            </Select>
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
