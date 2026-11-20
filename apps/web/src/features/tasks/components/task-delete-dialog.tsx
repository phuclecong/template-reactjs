import { useTranslation } from "react-i18next"
import { useDelete, type HttpError } from "@refinedev/core"
import type { TaskRecord } from "@workspace/api/schemas"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"

import { track } from "@/observability"
import { describeError } from "@/utils/http-error"

export function DeleteTaskDialog({
  open,
  task,
  onClose,
}: {
  open: boolean
  task: TaskRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const deleteMutation = useDelete<TaskRecord>({})

  function onConfirm() {
    if (!task) return
    deleteMutation.mutate(
      {
        resource: "tasks",
        id: task.id,
        invalidates: ["resourceAll"],
        successNotification: {
          message: t("taskDialog.deleted"),
          type: "success",
        },
        errorNotification: (error?: HttpError) => ({
          message: t("taskDialog.failedDelete"),
          type: "error",
          description: describeError(error),
        }),
      },
      {
        onSuccess: () => {
          track("task.deleted", { taskId: task.id })
          onClose()
        },
      }
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t("taskDialog.deleteTitle")}
      description={t("taskDialog.deleteBody", { title: task?.title ?? "" })}
      confirmLabel={t("common.delete")}
      cancelLabel={t("common.cancel")}
      loading={deleteMutation.mutation.isPending}
      onConfirm={onConfirm}
      tone="destructive"
    />
  )
}
