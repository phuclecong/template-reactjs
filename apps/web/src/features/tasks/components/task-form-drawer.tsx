import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { HttpError } from "@refinedev/core"
import { useForm } from "@refinedev/react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import type { TaskRecord } from "@workspace/api/schemas"
import {
  ComboboxFilter,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { useEnums } from "@workspace/shared-lib/hooks"
import { Button } from "@workspace/ui/components/button"
import { DatePicker } from "@workspace/ui/components/date-picker"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { resolveLocale } from "@workspace/ui/lib/date"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"

import type { UserOption } from "@/features/tasks/utils"
import {
  createTaskFormSchema,
  toTaskFormValues,
  toTaskPayload,
  type TaskFormValues,
} from "@/features/tasks/utils/task-schema"
import { track } from "@/observability"
import { describeError } from "@/utils/http-error"

/**
 * Create/edit drawer. It remounts on every open (`useDialog` version), so one
 * Refine `useForm` instance never switches action; the edit prefill comes from
 * the table row instead of a duplicate detail request.
 */
export function TaskFormDrawer({
  open,
  task,
  users,
  onClose,
}: {
  open: boolean
  task: TaskRecord | null
  users: UserOption[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const {
    TASK_STATUS_OPTIONS: statusOptions,
    TASK_PRIORITY_OPTIONS: priorityOptions,
  } = useEnums()
  const isEdit = task !== null
  const editingId = task?.id
  const locale = resolveLocale(i18n.language)
  const fieldId = "task-form"

  // Base UI does not animate a popup that mounts already open. The drawer is
  // code-split and mounts on first use, so enter one frame after mount to let
  // the slide-in transition run. `visible` derives back to false as soon as
  // the parent closes it, which starts the slide-out.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!open || entered) return
    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [open, entered])
  const visible = open && entered

  const schema = useMemo(
    () => createTaskFormSchema({ titleRequired: t("validation.required") }),
    [t]
  )

  const priorityChoices = useMemo<FilterOption[]>(
    () => [{ value: "", label: t("taskDialog.none") }, ...priorityOptions],
    [priorityOptions, t]
  )

  const assigneeChoices = useMemo<FilterOption[]>(
    () => [
      { value: "", label: t("taskDialog.unassigned") },
      ...users.map((user) => ({ value: user.id, label: user.name })),
    ],
    [users, t]
  )

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    refineCore: { onFinish, formLoading },
  } = useForm<TaskRecord, HttpError, TaskFormValues>({
    refineCoreProps: {
      resource: "tasks",
      action: isEdit ? "edit" : "create",
      id: editingId,
      // The edit prefill already comes from the table row; the detail request
      // would be a duplicate fetch.
      queryOptions: { enabled: false },
      redirect: false,
      invalidates: ["resourceAll"],
      successNotification: {
        message: isEdit ? t("taskDialog.updated") : t("taskDialog.created"),
        type: "success",
      },
      errorNotification: (error) => ({
        message: isEdit
          ? t("taskDialog.failedUpdate")
          : t("taskDialog.failedCreate"),
        type: "error",
        description: describeError(error),
      }),
    },
    resolver: zodResolver(schema),
    defaultValues: toTaskFormValues(task),
    warnWhenUnsavedChanges: false,
  })

  const isPending = formLoading || isSubmitting

  async function onSubmit(values: TaskFormValues) {
    const payload = toTaskPayload(values)

    try {
      const result = await onFinish(payload as TaskFormValues)
      const taskId = isEdit
        ? editingId
        : (result as { data?: TaskRecord } | undefined)?.data?.id
      if (taskId) {
        track(isEdit ? "task.updated" : "task.created", { taskId })
      }
      onClose()
    } catch {
      // Refine already surfaced the failure through `errorNotification`.
    }
  }

  return (
    <Sheet
      open={visible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-md"
        aria-labelledby={`${fieldId}-title`}
      >
        <SheetHeader>
          <SheetTitle id={`${fieldId}-title`}>
            {isEdit ? t("taskDialog.editTitle") : t("taskDialog.newTitle")}
          </SheetTitle>
        </SheetHeader>

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${fieldId}-title-input`}>
                    {t("taskDialog.title")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={`${fieldId}-title-input`}
                    autoFocus
                    disabled={isSubmitting}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${fieldId}-description`}>
                    {t("taskDialog.description")}
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id={`${fieldId}-description`}
                    rows={3}
                    disabled={isSubmitting}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="status"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${fieldId}-status`}>
                    {t("taskDialog.status")}
                  </FieldLabel>
                  <ComboboxFilter
                    id={`${fieldId}-status`}
                    options={statusOptions}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    ariaLabel={t("taskDialog.status")}
                    placeholder={t("taskDialog.status")}
                    className="w-full"
                    disabled={isSubmitting}
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
                  <FieldLabel htmlFor={`${fieldId}-priority`}>
                    {t("taskDialog.priority")}
                  </FieldLabel>
                  <ComboboxFilter
                    id={`${fieldId}-priority`}
                    options={priorityChoices}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    ariaLabel={t("taskDialog.priority")}
                    placeholder={t("taskDialog.priority")}
                    className="w-full"
                    disabled={isSubmitting}
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
                  <FieldLabel htmlFor={`${fieldId}-assignee`}>
                    {t("taskDialog.assignee")}
                  </FieldLabel>
                  <ComboboxFilter
                    id={`${fieldId}-assignee`}
                    options={assigneeChoices}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    ariaLabel={t("taskDialog.assignee")}
                    placeholder={t("taskDialog.assignee")}
                    className="w-full"
                    disabled={isSubmitting}
                    ariaInvalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="dueDate"
              render={({ field, fieldState }) => {
                const errorId = `${fieldId}-due-date-error`
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${fieldId}-due-date`}>
                      {t("taskDialog.dueDate")}
                    </FieldLabel>
                    <DatePicker
                      ref={field.ref}
                      id={`${fieldId}-due-date`}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isPending}
                      locale={locale}
                      placeholder={t("taskDialog.dueDatePlaceholder")}
                      labels={{
                        clear: t("common.clear"),
                        done: t("common.done"),
                        time: t("datePicker.time"),
                        typedEntryLabel: t("datePicker.typedLabel"),
                        typedEntryHint: t("datePicker.typedHint"),
                        typedEntryError: t("datePicker.typedError"),
                      }}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.error ? errorId : undefined}
                    />
                    <FieldError id={errorId} errors={[fieldState.error]} />
                  </Field>
                )
              }}
            />
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? t("taskDialog.save") : t("taskDialog.create")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
