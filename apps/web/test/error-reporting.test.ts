import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  installUnhandledRejectionReporter,
  reportError,
} from "@/utils/error-reporting"

describe("reportError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("normalizes a non-Error reason and logs it", () => {
    reportError("boom")

    const logged = vi.mocked(console.error).mock.calls[0]?.[0]
    expect(logged).toBeInstanceOf(Error)
    expect((logged as Error).message).toBe("boom")
  })

  it("includes the component stack when provided", () => {
    const error = new Error("render failed")

    reportError(error, { componentStack: "at Exploding" })

    expect(console.error).toHaveBeenCalledWith(error, "at Exploding")
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

    const logged = vi.mocked(console.error).mock.calls[0]?.[0]
    expect(logged).toBeInstanceOf(Error)
    expect((logged as Error).message).toBe("boom")
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
