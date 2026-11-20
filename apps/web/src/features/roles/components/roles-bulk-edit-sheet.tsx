import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { HttpError } from "@refinedev/core"
import { useForm } from "@refinedev/react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import type { RoleRecord, RoleStatus } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
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
  type RoleBulkFormValues,
} from "@/features/roles/utils/role-schema"

type StatusChoice = RoleStatus | ""

/**
 * Bulk edit form. Titles are excluded because they are unique. Refine's
 * `useForm` tracks which fields the Administrator touched, so the payload
 * carries only dirty fields; a description cleared to empty is sent as `null`.
 * The write itself goes through `useRolesBulkActions`, so `refineCore.onFinish`
 * is deliberately unused.
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

  const {
    control,
    handleSubmit,
    setValue,
    formState: { dirtyFields, isDirty },
  } = useForm<RoleRecord, HttpError, RoleBulkFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: "", status: "" },
    warnWhenUnsavedChanges: false,
  })

  // The empty string is both the initial value and the "clear" instruction, so
  // RHF cannot flag Clear as a change on its own (it unsets dirty when a value
  // matches the default). This flag records that explicit intent.
  const [descriptionCleared, setDescriptionCleared] = useState(false)
  const descriptionDirty =
    Boolean(dirtyFields.description) || descriptionCleared
  const hasChanges = isDirty || descriptionCleared

  // Empty string is the "unchanged" sentinel, so it doubles as the option that
  // lets the Administrator revert a touched status field.
  const statusChoices = useMemo<FilterOption[]>(
    () => [
      { value: "", label: t("roles.bulk.statusUnchanged") },
      ...statusOptions,
    ],
    [statusOptions, t]
  )

  const handleApply = handleSubmit((values) => {
    if (!hasChanges || isApplying) return
    const patch: RoleBulkPatch = {}
    if (descriptionDirty) {
      patch.description = normalizeRoleDescription(values.description)
    }
    if (dirtyFields.status && values.status !== "") {
      patch.status = values.status
    }
    if (Object.keys(patch).length === 0) return
    onApply(patch)
  })

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
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="roles-bulk-description">
                    {t("roles.bulk.description")}
                  </FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setValue("description", "", { shouldValidate: true })
                      setDescriptionCleared(true)
                    }}
                  >
                    {t("roles.bulk.clearDescription")}
                  </Button>
                </div>
                <Textarea
                  {...field}
                  id="roles-bulk-description"
                  placeholder={t("roles.bulk.descriptionPlaceholder")}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
                {!fieldState.error &&
                descriptionDirty &&
                normalizeRoleDescription(field.value) === null ? (
                  <p className="text-xs text-muted-foreground">
                    {t("roles.bulk.descriptionWillClear")}
                  </p>
                ) : null}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="roles-bulk-status">
                  {t("roles.bulk.status")}
                </FieldLabel>
                <ComboboxFilter
                  id="roles-bulk-status"
                  multiple={false}
                  options={statusChoices}
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as StatusChoice)
                  }
                  ariaLabel={t("roles.bulk.status")}
                  placeholder={t("roles.bulk.status")}
                  className="w-full"
                  disabled={isApplying}
                  showClear={false}
                  ariaInvalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
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
            onClick={() => void handleApply()}
            disabled={!hasChanges || isApplying}
          >
            {t("roles.bulk.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
