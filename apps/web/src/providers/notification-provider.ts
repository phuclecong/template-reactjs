import type { NotificationProvider } from "@refinedev/core"
import { toast } from "@workspace/ui/lib/sonner"

/**
 * Refine notificationProvider (ADR-0002). Wires Refine's notification bus to
 * sonner toasts, so data-hook mutations surface success/error feedback without
 * touching call sites.
 */
export const notificationProvider: NotificationProvider = {
  open: ({ message, type, description, key }) => {
    // A stable id coalesces a repeated identical notification into the toast
    // already on screen instead of stacking a second copy. Refine's `key` wins
    // when provided; otherwise type+message is stable and distinct per message.
    const id = key ?? `${type}:${message}`
    const options = description ? { id, description } : { id }
    if (type === "success") {
      toast.success(message, options)
    } else if (type === "error") {
      toast.error(message, options)
    } else {
      toast(message, options)
    }
  },
  close: (key) => {
    toast.dismiss(key)
  },
}
