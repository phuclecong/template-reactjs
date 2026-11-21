import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { HttpError } from "@refinedev/core"
import { useForm } from "@refinedev/react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import { z } from "zod"
import {
  taskPrioritySchema,
  taskStatusSchema,
  type TaskRecord,
} from "@workspace/api/schemas"
import {
  ComboboxFilter,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { useClearIntent, useEnums } from "@workspace/shared-lib/hooks"
import { Button } from "@workspace/ui/components/button"
import { DatePicker } from "@workspace/ui/components/date-picker"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { resolveLocale } from "@workspace/ui/lib/date"

import type { TaskBulkPatch } from "@/features/tasks/hooks/use-task-bulk-actions"
import { formValueToDueDate } from "@/features/tasks/utils/task-schema"
import type { UserOption } from "@/features/tasks/utils"

/**
 * Bulk edit form. The API accepts status, priority, assignee, and due date; an
 * empty value on each control means "leave unchanged", so the payload carries
 * only dirty fields. Priority "None", assignee "Unassigned", and an explicit
 * due-date clear are sent as `null`. Apply is the only confirmation.
 */
const bulkSchema = z.object({
  status: z.union([z.literal(""), taskStatusSchema]),
  priority: z.union([z.literal(""), z.literal("none"), taskPrioritySchema]),
  // "" = unchanged; "unassigned" = null; anything else is a User id.
  assigneeId: z.string(),
  dueDate: z.string(),
})

type TaskBulkFormValues = z.infer<typeof bulkSchema>

export function TasksBulkEditSheet({
  open,
  onOpenChange,
  selectedCount,
  users,
  onApply,
  isApplying,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  users: UserOption[]
  onApply: (patch: TaskBulkPatch) => void
  isApplying: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = resolveLocale(i18n.language)

  // Base UI does not animate a popup that mounts already open, and this sheet
  // is code-split. Enter one frame after mount so the slide-in transition
  // runs; `visible` derives back to false when the parent closes it, which
  // starts the slide-out while the sheet stays mounted.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!open || entered) return
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [open, entered])
  const visible = open && entered
  const {
    TASK_STATUS_OPTIONS: statusOptions,
    TASK_PRIORITY_OPTIONS: priorityOptions,
  } = useEnums()

  const {
    control,
    handleSubmit,
    setValue,
    formState: { dirtyFields, isDirty },
  } = useForm<TaskRecord, HttpError, TaskBulkFormValues>({
    resolver: zodResolver(bulkSchema),
    defaultValues: { status: "", priority: "", assigneeId: "", dueDate: "" },
    warnWhenUnsavedChanges: false,
  })

  const { isFieldDirty, hasChanges, markCleared, resetCleared } =
    useClearIntent<"dueDate">({ dirtyFields, isDirty })
  const dueDateDirty = isFieldDirty("dueDate")

  const statusChoices = useMemo<FilterOption[]>(
    () => [
      { value: "", label: t("tasks.bulk.statusUnchanged") },
      ...statusOptions,
    ],
    [statusOptions, t]
  )
  const priorityChoices = useMemo<FilterOption[]>(
    () => [
      { value: "", label: t("tasks.bulk.statusUnchanged") },
      { value: "none", label: t("tasks.bulk.none") },
      ...priorityOptions,
    ],
    [priorityOptions, t]
  )
  const assigneeChoices = useMemo<FilterOption[]>(
    () => [
      { value: "", label: t("tasks.bulk.statusUnchanged") },
      { value: "unassigned", label: t("tasks.unassigned") },
      ...users.map((user) => ({ value: user.id, label: user.name })),
    ],
    [users, t]
  )

  const handleApply = handleSubmit((values) => {
    if (!hasChanges || isApplying) return
    const patch: TaskBulkPatch = {}
    if (dirtyFields.status && values.status !== "") {
      patch.status = values.status
    }
    if (dirtyFields.priority && values.priority !== "") {
      patch.priority = values.priority === "none" ? null : values.priority
    }
    if (dirtyFields.assigneeId && values.assigneeId !== "") {
      patch.assigneeId =
        values.assigneeId === "unassigned" ? null : values.assigneeId
    }
    if (dueDateDirty) {
      patch.dueDate = values.dueDate
        ? formValueToDueDate(values.dueDate)
        : null
    }
    if (Object.keys(patch).length === 0) return
    onApply(patch)
  })

  return (
    <Sheet open={visible} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {t("tasks.bulk.editTitle", { count: selectedCount })}
          </SheetTitle>
          <SheetDescription>{t("tasks.bulk.editDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <Controller
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="tasks-bulk-status">
                  {t("tasks.bulk.status")}
                </FieldLabel>
                <ComboboxFilter
                  id="tasks-bulk-status"
                  multiple={false}
                  options={statusChoices}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  ariaLabel={t("tasks.bulk.status")}
                  placeholder={t("tasks.bulk.status")}
                  className="w-full"
                  disabled={isApplying}
                  showClear={false}
                  ariaInvalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="priority"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="tasks-bulk-priority">
                  {t("tasks.bulk.priority")}
                </FieldLabel>
                <ComboboxFilter
                  id="tasks-bulk-priority"
                  multiple={false}
                  options={priorityChoices}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  ariaLabel={t("tasks.bulk.priority")}
                  placeholder={t("tasks.bulk.priority")}
                  className="w-full"
                  disabled={isApplying}
                  showClear={false}
                  ariaInvalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="assigneeId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="tasks-bulk-assignee">
                  {t("tasks.bulk.assignee")}
                </FieldLabel>
                <ComboboxFilter
                  id="tasks-bulk-assignee"
                  multiple={false}
                  options={assigneeChoices}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  ariaLabel={t("tasks.bulk.assignee")}
                  placeholder={t("tasks.bulk.assignee")}
                  className="w-full"
                  disabled={isApplying}
                  showClear={false}
                  ariaInvalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="dueDate"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="tasks-bulk-due-date">
                    {t("tasks.bulk.dueDate")}
                  </FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setValue("dueDate", "", { shouldValidate: true })
                      markCleared("dueDate")
                    }}
                  >
                    {t("tasks.bulk.clearDueDate")}
                  </Button>
                </div>
                <DatePicker
                  ref={field.ref}
                  id="tasks-bulk-due-date"
                  name={field.name}
                  value={field.value}
                  onChange={(value) => {
                    resetCleared("dueDate")
                    field.onChange(value)
                  }}
                  onBlur={field.onBlur}
                  disabled={isApplying}
                  locale={locale}
                  placeholder={t("tasks.bulk.dueDatePlaceholder")}
                  labels={{
                    clear: t("common.clear"),
                    done: t("common.done"),
                    time: t("datePicker.time"),
                    typedEntryLabel: t("datePicker.typedLabel"),
                    typedEntryHint: t("datePicker.typedHint"),
                    typedEntryError: t("datePicker.typedError"),
                  }}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
                {dueDateDirty && !field.value ? (
                  <p className="text-xs text-muted-foreground">
                    {t("tasks.bulk.dueDateWillClear")}
                  </p>
                ) : null}
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
            {t("tasks.bulk.applyChanges")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
