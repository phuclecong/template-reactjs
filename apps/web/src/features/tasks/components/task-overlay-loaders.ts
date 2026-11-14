/**
 * Dynamic imports for the Tasks overlays. Both `RetryableLazy` (on render) and
 * the intent prefetch handlers share these factories, so a hovered trigger
 * warms exactly the module the overlay will load.
 *
 * Nothing here runs at module evaluation, so no overlay chunk is requested at
 * startup or while idle.
 */
export const taskOverlayLoaders = {
  form: () =>
    import("./task-dialogs").then((module) => ({
      default: module.TaskFormDialog,
    })),
  delete: () =>
    import("./task-dialogs").then((module) => ({
      default: module.DeleteTaskDialog,
    })),
  bulk: () =>
    import("./task-bulk-actions-content").then((module) => ({
      default: module.TaskBulkActionsContent,
    })),
}

export type TaskOverlay = keyof typeof taskOverlayLoaders

/**
 * Warms an overlay chunk on user intent. A failed optimistic import is
 * swallowed: the overlay's own error boundary owns the real failure surface,
 * and prefetching must never trigger the lazy-retry reload path.
 */
export function prefetchTaskOverlay(overlay: TaskOverlay): Promise<unknown> {
  return taskOverlayLoaders[overlay]().catch(() => undefined)
}
