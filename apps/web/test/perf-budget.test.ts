import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  assertNoMaskedResources,
  compareToBudgets,
  median,
  routeFromUrl,
  summarizeReports,
  sumTransferBytes,
} from "../scripts/perf/budget.mjs"

function loadFixture(name: string) {
  const url = new URL(`./fixtures/perf/${name}`, import.meta.url)
  return JSON.parse(readFileSync(url, "utf8"))
}

const loginRuns = [
  loadFixture("lhr-login-run1.json"),
  loadFixture("lhr-login-run2.json"),
  loadFixture("lhr-login-run3.json"),
]
const tasksRuns = [
  loadFixture("lhr-tasks-run1.json"),
  loadFixture("lhr-tasks-run2.json"),
  loadFixture("lhr-tasks-run3.json"),
]

describe("sumTransferBytes", () => {
  it("sums only the requested resource type", () => {
    expect(sumTransferBytes(loginRuns[0], "Script")).toBe(1_005_000)
    expect(sumTransferBytes(loginRuns[0], "Stylesheet")).toBe(50_000)
  })

  it("returns zero when the report has no network requests", () => {
    expect(sumTransferBytes({ audits: {} }, "Script")).toBe(0)
  })
})

describe("service-worker masking guard", () => {
  const masked = loadFixture("lhr-tasks-masked.json")

  it("fails when a Script reports a header-only transferSize", () => {
    expect(() => assertNoMaskedResources(masked)).toThrow(
      /service-worker masking.*under-measurement/i
    )
  })

  it("fails when a Stylesheet reports a header-only transferSize", () => {
    const report = {
      requestedUrl: "http://localhost:4173/login",
      audits: {
        "network-requests": {
          details: {
            items: [
              {
                url: "http://localhost:4173/assets/index.css",
                resourceType: "Stylesheet",
                transferSize: 100,
              },
            ],
          },
        },
      },
    }

    expect(() => assertNoMaskedResources(report)).toThrow(
      /service-worker masking.*under-measurement/i
    )
  })

  it("fails at the 256 B boundary but accepts an honest 511 B chunk", () => {
    const report = (transferSize: number) => ({
      requestedUrl: "http://localhost:4173/dashboard/tasks",
      audits: {
        "network-requests": {
          details: {
            items: [
              {
                url: "http://localhost:4173/assets/http-error-abc.js",
                resourceType: "Script",
                transferSize,
              },
            ],
          },
        },
      },
    })

    expect(() => assertNoMaskedResources(report(256))).toThrow(
      /service-worker masking.*under-measurement/i
    )
    expect(() => assertNoMaskedResources(report(257))).not.toThrow()
    expect(() => assertNoMaskedResources(report(511))).not.toThrow()
  })

  it("accepts the honest reports whose scripts carry response bodies", () => {
    expect(() => assertNoMaskedResources(loginRuns[0])).not.toThrow()
    expect(() => assertNoMaskedResources(tasksRuns[0])).not.toThrow()
  })

  it("blocks a summary built from a masked run", () => {
    expect(() => summarizeReports([masked])).toThrow(
      /service-worker masking.*under-measurement/i
    )
  })
})

describe("median", () => {
  it("returns the middle value for an odd sample", () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it("averages the middle pair for an even sample", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it("rejects an empty sample", () => {
    expect(() => median([])).toThrow()
  })
})

describe("summarizeReports", () => {
  it("uses the median run for bytes and timing metrics", () => {
    const summary = summarizeReports(loginRuns)

    expect(summary).toEqual({
      url: "http://localhost:4173/login",
      route: "/login",
      runs: 3,
      jsBytes: 1_012_000,
      cssBytes: 50_000,
      performanceScore: 0.9,
      fcpMs: 1500,
      lcpMs: 2900,
      tbtMs: 180,
      cls: 0.02,
    })
  })

  it("keeps the authenticated route separate", () => {
    const summary = summarizeReports(tasksRuns)

    expect(summary.route).toBe("/dashboard/tasks")
    expect(summary.jsBytes).toBe(1_210_000)
    expect(summary.cssBytes).toBe(55_000)
    expect(summary.lcpMs).toBe(3200)
    expect(summary.tbtMs).toBe(300)
  })

  it("groups by the requested route even when the app redirects client-side", () => {
    const bounced = tasksRuns.map((report) => ({
      ...report,
      finalDisplayedUrl: "http://localhost:4173/login",
    }))

    expect(summarizeReports(bounced).route).toBe("/dashboard/tasks")
  })

  it("refuses to mix runs from different routes", () => {
    expect(() => summarizeReports([loginRuns[0], tasksRuns[0]])).toThrow(
      /same route/
    )
  })
})

describe("compareToBudgets", () => {
  const budgets = {
    "/login": { jsBytes: 1_012_000, cssBytes: 50_000 },
    "/dashboard/tasks": { jsBytes: 1_220_000, cssBytes: 55_000 },
  }

  it("passes when the measured bytes equal the ceiling", () => {
    const comparison = compareToBudgets(
      [summarizeReports(loginRuns), summarizeReports(tasksRuns)],
      budgets
    )

    expect(comparison).toEqual([
      {
        route: "/login",
        passed: true,
        entries: [
          { metric: "jsBytes", measured: 1_012_000, ceiling: 1_012_000, passed: true },
          { metric: "cssBytes", measured: 50_000, ceiling: 50_000, passed: true },
        ],
      },
      {
        route: "/dashboard/tasks",
        passed: true,
        entries: [
          { metric: "jsBytes", measured: 1_210_000, ceiling: 1_220_000, passed: true },
          { metric: "cssBytes", measured: 55_000, ceiling: 55_000, passed: true },
        ],
      },
    ])
  })

  it("fails the route when any metric exceeds its ceiling", () => {
    const comparison = compareToBudgets([summarizeReports(loginRuns)], {
      "/login": { jsBytes: 1_000_000, cssBytes: 50_000 },
    })

    expect(comparison[0]?.passed).toBe(false)
    expect(comparison[0]?.entries).toEqual([
      { metric: "jsBytes", measured: 1_012_000, ceiling: 1_000_000, passed: false },
      { metric: "cssBytes", measured: 50_000, ceiling: 50_000, passed: true },
    ])
  })

  it("fails when a measured route has no budget entry", () => {
    expect(() => compareToBudgets([summarizeReports(loginRuns)], {})).toThrow(
      /No perf budget/
    )
  })
})

describe("routeFromUrl", () => {
  it("returns the pathname for a measured URL", () => {
    expect(routeFromUrl("http://localhost:4173/login")).toBe("/login")
    expect(routeFromUrl("http://localhost:4173/dashboard/tasks")).toBe(
      "/dashboard/tasks"
    )
  })

  it("ignores query strings and hash fragments", () => {
    expect(routeFromUrl("http://localhost:4173/login?from=ci#top")).toBe(
      "/login"
    )
  })
})
