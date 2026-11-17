import { createRequire } from "node:module"
import { describe, expect, it, vi } from "vitest"

import { signToken } from "@workspace/api/auth"

const require = createRequire(import.meta.url)
const login = require("../scripts/perf/login.cjs") as {
  (browser: FakeBrowser, context: { url: string }): Promise<void>
  buildSession(): string
  injectSession(page: FakePage, session: string): Promise<void>
}

type FakePage = {
  goto?: ReturnType<typeof vi.fn>
  evaluateOnNewDocument: ReturnType<typeof vi.fn>
}

type FakeTarget = {
  type: () => string
  page: () => Promise<FakePage>
}

function fakeBrowser(pages: FakePage[] = []) {
  const listeners = new Map<string, Array<(target: FakeTarget) => void>>()

  return {
    pages: vi.fn(async () => pages),
    on: vi.fn((event: string, handler: (target: FakeTarget) => void) => {
      const handlers = listeners.get(event) ?? []
      handlers.push(handler)
      listeners.set(event, handlers)
    }),
    emit(event: string, target: FakeTarget) {
      for (const handler of listeners.get(event) ?? []) handler(target)
    },
  }
}

type FakeBrowser = ReturnType<typeof fakeBrowser>

function fakePage() {
  return {
    goto: vi.fn(),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
  }
}

describe("perf login step", () => {
  it("builds the deterministic admin session the mock backend accepts", () => {
    const session = JSON.parse(login.buildSession())

    expect(session.token).toBe(
      signToken({ sub: "usr_admin", role: "admin", type: "access" })
    )
    expect(session.user).toEqual({
      id: "usr_admin",
      name: "Ada Admin",
      email: "admin@example.com",
      role: "admin",
    })
  })

  it("seeds the audited dashboard tab before app modules run, without navigating", async () => {
    const page = fakePage()
    const browser = fakeBrowser([page])

    await login(browser, { url: "http://localhost:4173/tasks" })

    expect(page.goto).not.toHaveBeenCalled()
    expect(page.evaluateOnNewDocument).toHaveBeenCalledTimes(1)
    const [script, key, value] = page.evaluateOnNewDocument.mock.calls[0]!
    expect(typeof script).toBe("function")
    expect(key).toBe("auth.session")
    expect(JSON.parse(value).user.id).toBe("usr_admin")
  })

  it("seeds Lighthouse's page target as soon as it is created", async () => {
    const browser = fakeBrowser()
    await login(browser, { url: "http://localhost:4173/tasks" })

    const audited = fakePage()
    browser.emit("targetcreated", {
      type: () => "page",
      page: async () => audited,
    })

    await vi.waitFor(() =>
      expect(audited.evaluateOnNewDocument).toHaveBeenCalledTimes(1)
    )
    expect(audited.goto).not.toHaveBeenCalled()
  })

  it("ignores non-page targets", async () => {
    const browser = fakeBrowser()
    await login(browser, { url: "http://localhost:4173/tasks" })

    const page = fakePage()
    browser.emit("targetcreated", {
      type: () => "service_worker",
      page: async () => page,
    })

    expect(page.evaluateOnNewDocument).not.toHaveBeenCalled()
  })

  it.each(["/dashboard", "/tasks", "/users", "/settings"])(
    "seeds every authenticated route (%s)",
    async (route) => {
      const page = fakePage()
      const browser = fakeBrowser([page])

      await login(browser, { url: `http://localhost:4173${route}` })

      expect(page.evaluateOnNewDocument).toHaveBeenCalledTimes(1)
      expect(browser.on).toHaveBeenCalledWith(
        "targetcreated",
        expect.any(Function)
      )
    }
  )

  it.each(["/login", "/register"])(
    "leaves the anonymous %s route untouched",
    async (route) => {
      const page = fakePage()
      const browser = fakeBrowser([page])

      await login(browser, { url: `http://localhost:4173${route}` })

      expect(page.goto).not.toHaveBeenCalled()
      expect(page.evaluateOnNewDocument).not.toHaveBeenCalled()
      expect(browser.on).not.toHaveBeenCalled()
    }
  )
})
