// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

import { installWebVitals, setSink } from "@/observability"
import type { Entry } from "@/observability"

type MetricCallback = (metric: {
  value: number
  rating: "good" | "needs-improvement" | "poor"
}) => void

const { registered } = vi.hoisted(() => ({
  registered: {} as Record<string, MetricCallback>,
}))

vi.mock("web-vitals/onLCP.js", () => ({
  onLCP: (callback: MetricCallback) => {
    registered.LCP = callback
  },
}))
vi.mock("web-vitals/onCLS.js", () => ({
  onCLS: (callback: MetricCallback) => {
    registered.CLS = callback
  },
}))
vi.mock("web-vitals/onINP.js", () => ({
  onINP: (callback: MetricCallback) => {
    registered.INP = callback
  },
}))

function captureEntries(): Entry[] {
  const entries: Entry[] = []
  setSink((entry) => entries.push(entry))
  return entries
}

afterEach(() => {
  setSink()
  vi.restoreAllMocks()
})

describe("installWebVitals", () => {
  it("registers LCP, CLS, and INP", () => {
    installWebVitals()

    expect(Object.keys(registered).sort()).toEqual(["CLS", "INP", "LCP"])
  })

  it.each([
    ["LCP", "good", 1234.5],
    ["CLS", "needs-improvement", 0.2],
    ["INP", "poor", 700],
  ] as const)("emits one metric entry for %s", (name, rating, value) => {
    const entries = captureEntries()
    installWebVitals()

    registered[name]?.({ value, rating })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      kind: "metric",
      level: "info",
      metric: { name, value, rating },
      context: {
        sessionId: expect.any(String),
        path: "/",
        userAgent: expect.any(String),
        env: "test",
      },
    })
  })

  it("adds no page-hide handler of its own", () => {
    const addEventListener = vi.spyOn(window, "addEventListener")

    installWebVitals()

    expect(addEventListener).not.toHaveBeenCalled()
  })
})
