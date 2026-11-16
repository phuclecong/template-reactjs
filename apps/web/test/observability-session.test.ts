// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const STORAGE_KEY = "observability.session"

async function loadSession() {
  return import("@/observability")
}

beforeEach(() => {
  vi.resetModules()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("getAnalyticsSessionId", () => {
  it("creates an id and persists it under observability.session", async () => {
    const { getAnalyticsSessionId } = await loadSession()

    const id = getAnalyticsSessionId()

    expect(id).toMatch(/[0-9a-z-]{8,}/i)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(id)
    expect(getAnalyticsSessionId()).toBe(id)
  })

  it("reuses an id already in session storage", async () => {
    sessionStorage.setItem(STORAGE_KEY, "existing-id")
    const { getAnalyticsSessionId } = await loadSession()

    expect(getAnalyticsSessionId()).toBe("existing-id")
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("existing-id")
  })

  it("falls back to module memory when storage access throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied")
    })
    const { getAnalyticsSessionId } = await loadSession()

    const first = getAnalyticsSessionId()

    expect(first).toBeTruthy()
    expect(getAnalyticsSessionId()).toBe(first)
  })

  it("never reads or writes auth.session", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const { getAnalyticsSessionId } = await loadSession()

    getAnalyticsSessionId()

    for (const [key] of getItem.mock.calls) {
      expect(key).not.toBe("auth.session")
    }
    for (const [key] of setItem.mock.calls) {
      expect(key).not.toBe("auth.session")
    }
  })
})
