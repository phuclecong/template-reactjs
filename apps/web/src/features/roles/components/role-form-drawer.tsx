import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react"
import { useTranslation } from "react-i18next"
import type { HttpError } from "@refinedev/core"
import { useModalForm } from "@refinedev/react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import type { RoleRecord } from "@workspace/api/schemas"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { track } from "@/observability"
import { describeError } from "@/utils/http-error"
import {
  createRoleFormSchema,
  emptyRoleFormValues,
  toCreateRolePayload,
  toDirtyRolePayload,
  type RoleFormValues,
} from "@/features/roles/utils/role-schema"

export type RoleFormDrawerHandle = {
  openCreate: () => void
  openEdit: (id: string) => void
}

type RoleFormSheetHandle = {
  open: (id?: string) => void
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const candidate = error as {
    code?: unknown
    response?: { data?: { code?: unknown } }
  }
  const code = candidate.response?.data?.code ?? candidate.code
  return typeof code === "string" ? code : undefined
}

/**
 * One create/edit drawer. Refine's `useForm` binds its mutation to a fixed
 * action, so each mode gets its own `useModalForm` instance (the documented
 * create/edit pattern). Both render the same Sheet and the same shared Zod
 * schema; only one is visible at a time.
 */
function RoleFormSheet({
  mode,
  ref,
}: {
  mode: "create" | "edit"
  ref?: Ref<RoleFormSheetHandle>
}) {
  const { t } = useTranslation()
  const isEdit = mode === "edit"
  const [editingId, setEditingId] = useState<string | undefined>()
  const [discardOpen, setDiscardOpen] = useState(false)

  const schema = useMemo(
    () =>
      createRoleFormSchema({
        titleRequired: t("roles.validation.titleRequired"),
        titleTooLong: t("roles.validation.titleTooLong"),
        descriptionTooLong: t("roles.validation.descriptionTooLong"),
      }),
    [t]
  )

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { dirtyFields, errors, isDirty, isSubmitting },
    refineCore: { onFinish, formLoading, id: refineId, query },
    modal: { visible, close, show },
  } = useModalForm<RoleRecord, HttpError, RoleFormValues>({
    refineCoreProps: {
      resource: "roles",
      action: mode,
      // Edit mode owns the detail request; create mode has no id. The query
      // stays disabled until a row supplies an id.
      id: isEdit ? editingId : undefined,
      queryOptions: { enabled: isEdit && editingId !== undefined },
      redirect: false,
      invalidates: ["list"],
      // Refine owns the single success toast; the drawer must not open a
      // second one after `onFinish`.
      successNotification: {
        message: t(isEdit ? "roles.updated" : "roles.created"),
        type: "success",
      },
    },
    // `useModalForm` must not write modal state into the table's URL.
    syncWithLocation: false,
    resolver: zodResolver(schema),
    defaultValues: emptyRoleFormValues(),
    warnWhenUnsavedChanges: false,
    modalProps: {
      autoSubmitClose: false,
      autoResetForm: false,
      autoResetFormWhenClose: true,
    },
  })

  // The detail endpoint returns `description: null`. Normalize it to the form's
  // string shape once the prefill arrives.
  const detail = query?.data?.data
  useEffect(() => {
    if (!visible || !isEdit || !detail) return
    reset({
      title: detail.title,
      description: detail.description ?? "",
      status: detail.status,
    })
  }, [visible, isEdit, detail, reset])

  useImperativeHandle(ref, () => ({
    open: (id?: string) => {
      clearErrors()
      reset(emptyRoleFormValues())
      if (isEdit && id !== undefined) {
        setEditingId(id)
        show(id)
      } else {
        show()
      }
    },
  }))

  const requestClose = () => {
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    close()
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("root")
    const payload = isEdit
      ? toDirtyRolePayload(values, dirtyFields)
      : toCreateRolePayload(values)

    // A pristine edit has nothing to submit.
    if (isEdit && Object.keys(payload).length === 0) {
      close()
      return
    }

    try {
      const result = await onFinish(payload as RoleFormValues)
      const roleId = isEdit
        ? (refineId ? String(refineId) : undefined)
        : (result as { data?: RoleRecord } | undefined)?.data?.id

      if (roleId) {
        track(isEdit ? "role.updated" : "role.created", { roleId })
      }
      close()
    } catch (error) {
      setError("root", {
        message:
          errorCode(error) === "duplicate_title"
            ? t("roles.form.duplicateTitle")
            : (describeError(error) ?? t("roles.form.error")),
      })
    }
  })

  const fieldId = `role-form-${mode}`

  return (
    <>
      <Sheet
        open={visible}
        onOpenChange={(nextOpen, eventDetails) => {
          if (nextOpen) return
          // Keep the drawer mounted; `requestClose` decides whether to ask.
          eventDetails.cancel()
          requestClose()
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 sm:max-w-md"
          aria-labelledby={`${fieldId}-title`}
        >
          <SheetHeader>
            <SheetTitle id={`${fieldId}-title`}>
              {isEdit ? t("roles.form.editTitle") : t("roles.form.createTitle")}
            </SheetTitle>
          </SheetHeader>

          <form
            noValidate
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {errors.root?.message ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive"
                >
                  {errors.root.message}
                </p>
              ) : null}

              <Controller
                control={control}
                name="title"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${fieldId}-title-input`}>
                      {t("roles.columns.title")}
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
                      {t("roles.columns.description")}
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={`${fieldId}-description`}
                      rows={4}
                      disabled={isSubmitting}
                      value={field.value ?? ""}
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
                      {t("roles.columns.status")}
                    </FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => field.onChange(value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id={`${fieldId}-status`}
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          {t("roles.status.active")}
                        </SelectItem>
                        <SelectItem value="inactive">
                          {t("roles.status.inactive")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <SheetFooter className="flex-row justify-end border-t">
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={formLoading || isSubmitting}>
                {isEdit
                  ? t("roles.form.saveAction")
                  : t("roles.form.createAction")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={t("roles.discard.title")}
        description={t("roles.discard.body")}
        confirmLabel={t("roles.discard.confirm")}
        cancelLabel={t("roles.discard.cancel")}
        onConfirm={() => {
          setDiscardOpen(false)
          close()
        }}
      />
    </>
  )
}

/**
 * Imperative entry point used by the Roles table. The write lifecycle for each
 * mode lives in its own `RoleFormSheet`; this wrapper only routes the table's
 * Create and Edit actions to the matching drawer.
 */
export function RoleFormDrawer({
  ref,
}: {
  ref?: Ref<RoleFormDrawerHandle>
}) {
  const createRef = useRef<RoleFormSheetHandle>(null)
  const editRef = useRef<RoleFormSheetHandle>(null)

  useImperativeHandle(ref, () => ({
    openCreate: () => createRef.current?.open(),
    openEdit: (id: string) => editRef.current?.open(id),
  }))

  return (
    <>
      <RoleFormSheet mode="create" ref={createRef} />
      <RoleFormSheet mode="edit" ref={editRef} />
    </>
  )
}
