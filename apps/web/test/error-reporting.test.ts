import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  installUnhandledRejectionReporter,
  reportError,
} from "@/observability"
import type { LogEntry } from "@/observability"

function firstConsoleError(): LogEntry {
  return vi.mocked(console.error).mock.calls[0]?.[0] as LogEntry
}

describe("reportError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("normalizes a non-Error reason and emits an error entry", () => {
    reportError("boom")

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(firstConsoleError()).toMatchObject({
      kind: "log",
      level: "error",
      message: "boom",
      data: {
        error: {
          name: "Error",
          message: "boom",
          stack: expect.any(String),
        },
      },
    })
  })

  it("includes the component stack in the entry data", () => {
    const error = new Error("render failed")

    reportError(error, { componentStack: "at Exploding" })

    const entry = firstConsoleError()
    expect(entry.data?.error).toMatchObject({
      name: "Error",
      message: "render failed",
    })
    expect(entry.data?.componentStack).toBe("at Exploding")
  })
})

describe("installUnhandledRejectionReporter", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reports the rejection reason without preventing the default", () => {
    const addEventListener = vi.fn()
    const target = {
      addEventListener,
    } as unknown as Pick<Window, "addEventListener">

    installUnhandledRejectionReporter(target)

    const [type, listener] = addEventListener.mock.calls[0] as [
      string,
      (event: PromiseRejectionEvent) => void,
    ]
    expect(type).toBe("unhandledrejection")

    const preventDefault = vi.fn()
    listener({
      reason: "boom",
      preventDefault,
    } as unknown as PromiseRejectionEvent)

    expect(firstConsoleError()).toMatchObject({
      kind: "log",
      level: "error",
      message: "boom",
    })
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
