/**
 * The mock backend's Live event bus.
 *
 * Mutation handlers publish here; the browser-only SSE handler forwards the
 * events to connected `EventSource` clients. This module deliberately imports
 * nothing from `msw`, so Node API tests can load the handlers that publish
 * without constructing an SSE handler (which requires a global `EventSource`).
 *
 * The payload carries ids only: the client treats a Live event as an
 * invalidation signal and refetches the authoritative Task summary.
 */
export type TaskLiveEvent = {
  channel: "resources/tasks"
  type: "created" | "updated" | "deleted"
  payload: { ids: string[] }
  date: string
}

type TaskLiveListener = (event: TaskLiveEvent) => void

const listeners = new Set<TaskLiveListener>()

export function publishTaskLiveEvent(
  type: TaskLiveEvent["type"],
  ids: readonly string[]
): void {
  if (ids.length === 0) return
  const event: TaskLiveEvent = {
    channel: "resources/tasks",
    type,
    payload: { ids: [...ids] },
    date: new Date().toISOString(),
  }
  for (const listener of listeners) listener(event)
}

export function subscribeToTaskLiveEvents(
  listener: TaskLiveListener
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
