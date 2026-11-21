import { sse } from "msw"
import { tasks } from "./collections"
import {
  publishTaskLiveEvent,
  subscribeToTaskLiveEvents,
  type TaskLiveEvent,
} from "./live-events"
import { getUserByAccessToken } from "./service"

/**
 * Browser-only Live transport. `sse()` refuses to construct without a global
 * `EventSource`, so this module is imported by the web MSW worker and never by
 * the Node smoke-test handler set (`data-handlers.ts`).
 *
 * The mock activity simulator keeps the Dashboard visibly live in the template:
 * while at least one client is connected it toggles a rotating seeded Task
 * between `todo` and `done`, publishing through the same bus as real mutations.
 * It creates no records, so the persisted store is not polluted, and the web
 * layer can disable it with `VITE_MOCK_LIVE_ACTIVITY=false`.
 */
const CHANNEL = "resources/tasks"
const ACTIVITY_INTERVAL_MS = 10_000

export interface LiveHandlerOptions {
  simulateActivity?: boolean
}

export function createLiveHandlers({
  simulateActivity = false,
}: LiveHandlerOptions = {}) {
  let connectedClients = 0
  let stopActivity: (() => void) | null = null

  return [
    sse<{ message: unknown; live: TaskLiveEvent }>(
      "*/api/events",
      ({ request, client }) => {
        const url = new URL(request.url)
        const channel = url.searchParams.get("channel")
        const token = url.searchParams.get("access_token")

        if (channel !== CHANNEL || !getUserByAccessToken(token)) {
          client.error()
          return
        }

        const unsubscribe = subscribeToTaskLiveEvents((event) => {
          client.send({ event: "live", data: event })
        })

        connectedClients += 1
        if (simulateActivity && !stopActivity) {
          stopActivity = startActivity()
        }

        const cleanup = () => {
          unsubscribe()
          connectedClients = Math.max(0, connectedClients - 1)
          if (connectedClients === 0) {
            stopActivity?.()
            stopActivity = null
          }
        }

        if (request.signal.aborted) {
          cleanup()
          return
        }
        request.signal.addEventListener("abort", cleanup, { once: true })
      }
    ),
  ]
}

function startActivity(): () => void {
  let cursor = 0
  let busy = false

  const tick = async () => {
    if (busy) return
    const allTasks = tasks.all()
    if (allTasks.length === 0) return

    busy = true
    try {
      const task = allTasks[cursor % allTasks.length]
      cursor += 1
      if (!task) return
      await tasks.update(task, {
        data(draft) {
          draft.status = draft.status === "done" ? "todo" : "done"
          draft.updatedAt = new Date().toISOString()
        },
        strict: true,
      })
      publishTaskLiveEvent("updated", [task.id])
    } catch {
      // The record can disappear between the snapshot and the update; the
      // simulator is best-effort and must not surface an unhandled rejection.
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => {
    void tick()
  }, ACTIVITY_INTERVAL_MS)

  return () => clearInterval(timer)
}
