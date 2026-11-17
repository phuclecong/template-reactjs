// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { log, setSink } from "@/observability"
import type { Entry, LogEntry } from "@/observability"

function captureEntries(): Entry[] {
  const entries: Entry[] = []
  setSink((entry) => entries.push(entry))
  return entries
}

beforeEach(() => {
  window.history.replaceState({}, "", "/")
})

afterEach(() => {
  setSink()
  vi.restoreAllMocks()
})

describe("log", () => {
  it("emits a module-owned context and the call-site data under data", () => {
    const entries = captureEntries()

    log("info", "hello", { count: 1 })

    expect(entries).toHaveLength(1)
    const entry = entries[0] as LogEntry
    expect(entry).toMatchObject({
      kind: "log",
      level: "info",
      message: "hello",
      data: { count: 1 },
      context: {
        sessionId: expect.any(String),
        path: "/",
        userAgent: expect.any(String),
        env: "test",
      },
    })
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
  })

  it("logs only the pathname, never the query string or hash", () => {
    window.history.replaceState({}, "", "/tasks?secret=hunter2#frag")
    const entries = captureEntries()

    log("info", "navigated")

    const entry = entries[0] as LogEntry
    expect(entry.context.path).toBe("/tasks")
    expect(JSON.stringify(entry)).not.toContain("hunter2")
    expect(JSON.stringify(entry)).not.toContain("frag")
  })

  it("cannot let call-site data overwrite the context or entry shape", () => {
    const entries = captureEntries()

    log("info", "safe", {
      context: { sessionId: "evil" },
      kind: "event",
      level: "error",
      message: "overwritten",
    })

    const entry = entries[0] as LogEntry
    expect(entry.kind).toBe("log")
    expect(entry.level).toBe("info")
    expect(entry.message).toBe("safe")
    expect(entry.context.sessionId).not.toBe("evil")
    expect(entry.data).toEqual({
      context: { sessionId: "evil" },
      kind: "event",
      level: "error",
      message: "overwritten",
    })
  })

  it("drops debug entries outside development", () => {
    const entries = captureEntries()

    log("debug", "hidden")
    log("warn", "visible")

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ level: "warn", message: "visible" })
  })

  it("serializes Errors, circular values, functions, and symbols safely", () => {
    const entries = captureEntries()
    const circular: Record<string, unknown> = { name: "loop" }
    circular.self = circular

    log("error", "failed", {
      error: new Error("boom"),
      circular,
      callback: () => {},
      token: Symbol("secret"),
      nested: [{ ok: true }],
    })

    const entry = entries[0] as LogEntry
    expect(entry.data?.error).toMatchObject({
      name: "Error",
      message: "boom",
      stack: expect.any(String),
    })
    expect(entry.data?.circular).toEqual({ name: "loop", self: "[Circular]" })
    expect(entry.data).not.toHaveProperty("callback")
    expect(entry.data).not.toHaveProperty("token")
    expect(entry.data?.nested).toEqual([{ ok: true }])
    expect(() => JSON.stringify(entry)).not.toThrow()
  })
})

describe("the sink", () => {
  it("isolates a throwing sink", () => {
    setSink(() => {
      throw new Error("sink down")
    })

    expect(() => log("info", "still safe")).not.toThrow()
  })

  it("restores the console sink when reset", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    setSink()
    log("info", "to console")

    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      kind: "log",
      message: "to console",
    })
  })
})
