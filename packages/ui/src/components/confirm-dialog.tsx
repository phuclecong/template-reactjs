import type { ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"

/**
 * Presentational confirmation dialog: the user must explicitly confirm or
 * cancel. It composes the registry `AlertDialog` parts, which render
 * `role="alertdialog"`, trap focus, and (Base UI) already ignore outside
 * clicks. Base UI still dispatches Escape for alert dialogs, so this
 * composition cancels that reason in `onOpenChange`; only the registry
 * `AlertDialogCancel` (explicit Cancel) and `onConfirm` callers can close it.
 *
 * The caller supplies already-translated labels and `onConfirm`, and keeps the
 * actual mutation (e.g. Refine's `useDelete`) at the call site. Confirming does
 * not close the dialog itself: the call site closes it when its mutation
 * settles, so a pending request stays visible with Confirm disabled.
 */
function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  loading = false,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  cancelLabel: ReactNode
  tone?: "danger" | "default"
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) return
        if (
          eventDetails.reason === "escape-key" ||
          eventDetails.reason === "outside-press"
        ) {
          eventDetails.cancel()
          return
        }
        onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description !== undefined ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={tone === "danger" ? "destructive" : "default"}
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDialog }
