// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { LiveEvent } from "@refinedev/core"

vi.mock("@/utils/mock-worker", () => ({
  ensureMockWorker: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/providers/auth-provider", () => ({
  getAuthToken: () => "token-1",
}))

import { getLiveStatus, liveProvider } from "@/providers/live-provider"

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []

  readyState = FakeEventSource.CONNECTING
  readonly url: string
  closed = false
  private listeners = new Map<string, Set<(event: Event) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  close(): void {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  emitOpen(): void {
    this.readyState = FakeEventSource.OPEN
    this.emit("open", new Event("open"))
  }

  emitError(readyState = FakeEventSource.CONNECTING): void {
    this.readyState = readyState
    this.emit("error", new Event("error"))
  }

  emitLive(data: unknown): void {
    this.emit("live", new MessageEvent("live", { data: JSON.stringify(data) }))
  }
}

async function subscribe(types: LiveEvent["type"][] = ["updated"]) {
  const callback = vi.fn<(event: LiveEvent) => void>()
  const handle = liveProvider.subscribe({
    channel: "resources/tasks",
    types,
    callback,
  })
  await vi.waitFor(() => {
    expect(FakeEventSource.instances).toHaveLength(1)
  })
  return { callback, handle, source: FakeEventSource.instances[0]! }
}

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal("EventSource", FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("liveProvider", () => {
  it("opens one authenticated SSE stream per subscription", async () => {
    await subscribe()

    expect(getLiveStatus()).toBe("connecting")
    const url = new URL(FakeEventSource.instances[0]!.url)
    expect(url.pathname).toBe("/api/events")
    expect(url.searchParams.get("channel")).toBe("resources/tasks")
    expect(url.searchParams.get("access_token")).toBe("token-1")
  })

  it("reports live after the stream opens", async () => {
    const { source } = await subscribe()

    source.emitOpen()

    expect(getLiveStatus()).toBe("live")
  })

  it("passes only accepted event types to the callback", async () => {
    const { callback, source } = await subscribe(["updated"])

    source.emitLive({
      channel: "resources/tasks",
      type: "created",
      payload: { ids: ["tsk_1"] },
      date: "2026-06-15T12:00:00.000Z",
    })
    expect(callback).not.toHaveBeenCalled()

    source.emitLive({
      channel: "resources/tasks",
      type: "updated",
      payload: { ids: ["tsk_1"] },
      date: "2026-06-15T12:00:00.000Z",
    })

    expect(callback).toHaveBeenCalledTimes(1)
    const event = callback.mock.calls[0]![0]
    expect(event.payload.ids).toEqual(["tsk_1"])
    expect(event.date).toBeInstanceOf(Date)
  })

  it("accepts every type when the subscription uses *", async () => {
    const { callback, source } = await subscribe(["*"])

    source.emitLive({
      channel: "resources/tasks",
      type: "deleted",
      payload: { ids: [] },
      date: "2026-06-15T12:00:00.000Z",
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("ignores malformed frames", async () => {
    const { callback, source } = await subscribe()

    source.emit("live", new MessageEvent("live", { data: "not json" }))
    source.emit(
      "live",
      new MessageEvent("live", { data: '{"type":"updated"}' })
    )

    expect(callback).not.toHaveBeenCalled()
  })

  it("maps an error to reconnecting and a closed stream to offline", async () => {
    const { source } = await subscribe()
    source.emitOpen()

    source.emitError(FakeEventSource.CONNECTING)
    expect(getLiveStatus()).toBe("reconnecting")

    source.emitError(FakeEventSource.CLOSED)
    expect(getLiveStatus()).toBe("offline")
  })

  it("closes the stream when Refine unsubscribes", async () => {
    const { handle, source } = await subscribe()
    source.emitOpen()

    liveProvider.unsubscribe(handle)

    expect(source.closed).toBe(true)
    expect(getLiveStatus()).toBe("offline")
  })
})
