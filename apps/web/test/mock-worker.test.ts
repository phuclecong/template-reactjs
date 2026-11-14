import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The heavy mock module (msw/browser + handlers + collections) must never be
// evaluated in the node test environment. The seam under test is the loader's
// observable contract: when it imports the module, whether it does so once,
// and how it surfaces failures.
const { startMockWorker } = vi.hoisted(() => ({
  startMockWorker: vi.fn<() => Promise<void>>(),
}))

vi.mock("@/utils/msw", () => ({ startMockWorker }))

/** Re-import the loader so its module-level promise starts fresh per test. */
async function loadLoader() {
  vi.resetModules()
  return import("@/utils/mock-worker")
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("ensureMockWorker", () => {
  it("resolves without loading the worker when there is no browser", async () => {
    const { ensureMockWorker } = await loadLoader()

    await expect(ensureMockWorker()).resolves.toBeUndefined()

    expect(startMockWorker).not.toHaveBeenCalled()
  })

  it("starts the worker once when concurrent requests need it", async () => {
    vi.stubGlobal("window", {})
    let finishStart!: () => void
    startMockWorker.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStart = resolve
        })
    )
    const { ensureMockWorker } = await loadLoader()

    const firstRequest = ensureMockWorker()
    const secondRequest = ensureMockWorker()

    await vi.waitFor(() =>
      expect(startMockWorker).toHaveBeenCalledTimes(1)
    )
    finishStart()
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      undefined,
      undefined,
    ])
  })

  it("does not restart the worker for later requests", async () => {
    vi.stubGlobal("window", {})
    startMockWorker.mockResolvedValue(undefined)
    const { ensureMockWorker } = await loadLoader()

    await ensureMockWorker()
    await ensureMockWorker()

    expect(startMockWorker).toHaveBeenCalledTimes(1)
  })

  it("rejects when the worker cannot start, so the request fails instead of hanging", async () => {
    vi.stubGlobal("window", {})
    startMockWorker.mockRejectedValueOnce(new Error("worker failed"))
    startMockWorker.mockResolvedValueOnce(undefined)
    const { ensureMockWorker } = await loadLoader()

    await expect(ensureMockWorker()).rejects.toThrow("worker failed")

    // A later request retries rather than reusing the rejected promise.
    await expect(ensureMockWorker()).resolves.toBeUndefined()
    expect(startMockWorker).toHaveBeenCalledTimes(2)
  })

  it("resolves without loading the worker when VITE_API_URL configures a real backend", async () => {
    vi.stubEnv("VITE_API_URL", "http://example.test/api")
    vi.stubGlobal("window", {})
    const { ensureMockWorker } = await loadLoader()

    await expect(ensureMockWorker()).resolves.toBeUndefined()

    expect(startMockWorker).not.toHaveBeenCalled()
  })
})
