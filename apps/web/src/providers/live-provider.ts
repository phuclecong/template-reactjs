import type { LiveEvent, LiveProvider } from "@refinedev/core"
import { useSyncExternalStore } from "react"

import { getAuthToken } from "@/providers/auth-provider"
import { apiUrl } from "@/utils/api-url"
import { ensureMockWorker } from "@/utils/mock-worker"

/**
 * SSE LiveProvider (ADR-0020). `@refinedev/simple-rest` ships no LiveProvider,
 * so this module owns the transport: one native `EventSource` per Refine
 * subscription, channel and event-type filtering, and the connection status the
 * Dashboard header renders.
 *
 * The access token travels as `access_token` because `EventSource` cannot set
 * an Authorization header. The stream carries ids only; consumers invalidate
 * and refetch rather than patch state from the payload.
 */
export type LiveStatus = "offline" | "connecting" | "live" | "reconnecting"

type SubscriptionHandle = { close: () => void }

const statusListeners = new Set<() => void>()
let status: LiveStatus = "offline"

function setStatus(next: LiveStatus): void {
  if (status === next) return
  status = next
  for (const listener of statusListeners) listener()
}

function subscribeToStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

/**
 * The connection status has no Refine hook: `useSubscription` exposes no
 * transport state, so the Dashboard reads this small external store instead.
 */
export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    subscribeToStatus,
    () => status,
    () => "offline"
  )
}

/** The current transport status, for tests and non-React callers. */
export function getLiveStatus(): LiveStatus {
  return status
}

function eventsUrl(channel: string, token: string | null): string {
  const base = `${apiUrl.replace(/\/$/, "")}/events`
  const url = new URL(base, window.location.origin)
  url.searchParams.set("channel", channel)
  if (token) url.searchParams.set("access_token", token)
  return url.toString()
}

function acceptsType(
  types: readonly string[] | undefined,
  type: string
): boolean {
  if (!types || types.length === 0) return true
  return types.includes("*") || types.includes(type)
}

function parseLiveEvent(data: unknown): LiveEvent | null {
  if (typeof data !== "string") return null

  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }

  if (typeof value !== "object" || value === null) return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.channel !== "string") return null
  if (typeof candidate.type !== "string" || candidate.type === "") return null
  if (typeof candidate.payload !== "object" || candidate.payload === null) {
    return null
  }

  const rawIds = (candidate.payload as Record<string, unknown>).ids
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string")
    : undefined

  const parsedDate =
    typeof candidate.date === "string" ? new Date(candidate.date) : new Date()

  return {
    channel: candidate.channel,
    type: candidate.type,
    payload: ids ? { ids } : {},
    date: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
  }
}

export const liveProvider: LiveProvider = {
  subscribe({ channel, types, callback }) {
    let source: EventSource | null = null
    let stopped = false

    const handle: SubscriptionHandle = {
      close() {
        stopped = true
        source?.close()
        source = null
        setStatus("offline")
      },
    }

    const open = async () => {
      try {
        // The first SSE request must start the mock worker without going
        // through the data provider; against a real backend this is a no-op.
        await ensureMockWorker()
      } catch {
        setStatus("offline")
        return
      }
      if (stopped || typeof EventSource === "undefined") {
        if (!stopped) setStatus("offline")
        return
      }

      setStatus("connecting")
      const eventSource = new EventSource(eventsUrl(channel, getAuthToken()))
      source = eventSource

      eventSource.addEventListener("open", () => {
        if (!stopped) setStatus("live")
      })

      eventSource.addEventListener("error", () => {
        if (stopped) return
        // Native EventSource reconnects on its own while CONNECTING; CLOSED
        // means it gave up (for example a rejected stream).
        setStatus(
          eventSource.readyState === EventSource.CLOSED
            ? "offline"
            : "reconnecting"
        )
      })

      eventSource.addEventListener("live", (message) => {
        if (stopped || !(message instanceof MessageEvent)) return
        const event = parseLiveEvent(message.data)
        if (
          !event ||
          event.channel !== channel ||
          !acceptsType(types, event.type)
        ) {
          return
        }
        callback(event)
      })
    }

    void open()
    return handle
  },

  unsubscribe(subscription) {
    ;(subscription as SubscriptionHandle | undefined)?.close()
  },
}
