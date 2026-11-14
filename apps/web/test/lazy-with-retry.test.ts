import { describe, expect, it, vi } from "vitest"

import {
  ChunkLoadError,
  lazyWithRetry,
  loadWithRetry,
  type RetryEnvironment,
} from "@/utils/lazy-with-retry"

function environment(
  overrides: Partial<RetryEnvironment> = {}
): RetryEnvironment {
  return {
    reload: vi.fn(),
    hasReloaded: () => false,
    markReloaded: vi.fn(),
    ...overrides,
  }
}

function moduleWith(Component: () => null) {
  return { default: Component }
}

describe("loadWithRetry", () => {
  it("returns the module without retrying when the first import succeeds", async () => {
    const Component = () => null
    const importer = vi.fn(async () => moduleWith(Component))
    const env = environment()

    await expect(loadWithRetry(importer, env)).resolves.toEqual({
      default: Component,
    })
    expect(importer).toHaveBeenCalledTimes(1)
    expect(env.reload).not.toHaveBeenCalled()
  })

  it("retries a failed import exactly once and returns the retry result", async () => {
    const Component = () => null
    const importer = vi
      .fn<() => Promise<{ default: () => null }>>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(moduleWith(Component))
    const env = environment()

    await expect(loadWithRetry(importer, env)).resolves.toEqual({
      default: Component,
    })
    expect(importer).toHaveBeenCalledTimes(2)
    expect(env.reload).not.toHaveBeenCalled()
    expect(env.markReloaded).not.toHaveBeenCalled()
  })

  it("marks and performs a full reload after repeated failure", async () => {
    const importer = vi.fn(async () => {
      throw new Error("chunk 404")
    })
    const env = environment()

    await expect(loadWithRetry(importer, env)).rejects.toBeInstanceOf(
      ChunkLoadError
    )
    expect(importer).toHaveBeenCalledTimes(2)
    expect(env.markReloaded).toHaveBeenCalledTimes(1)
    expect(env.reload).toHaveBeenCalledTimes(1)
  })

  it("does not reload in a loop once a reload was attempted this session", async () => {
    const importer = vi.fn(async () => {
      throw new Error("chunk still missing")
    })
    const env = environment({ hasReloaded: () => true })

    await expect(loadWithRetry(importer, env)).rejects.toBeInstanceOf(
      ChunkLoadError
    )
    expect(importer).toHaveBeenCalledTimes(2)
    expect(env.reload).not.toHaveBeenCalled()
    expect(env.markReloaded).not.toHaveBeenCalled()
  })

  it("surfaces the final failure as a handled rejection, never unhandled", async () => {
    const unhandled = vi.fn()
    const importer = vi.fn(async () => {
      throw new Error("chunk 404")
    })
    const env = environment()

    process.on("unhandledRejection", unhandled)
    try {
      const promise = loadWithRetry(importer, env)
      await expect(promise).rejects.toBeInstanceOf(ChunkLoadError)
      // Let any floating rejection surface before asserting.
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      process.removeListener("unhandledRejection", unhandled)
    }

    expect(unhandled).not.toHaveBeenCalled()
  })
})

describe("lazyWithRetry", () => {
  it("returns a React lazy component for the imported module", () => {
    const Component = lazyWithRetry(async () => moduleWith(() => null))

    expect(Component.$$typeof).toBe(Symbol.for("react.lazy"))
  })
})
