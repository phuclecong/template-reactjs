#!/usr/bin/env node
// Byte-budget and timing-summary calculator for the production Lighthouse runs.
//
// Input: the `lhr-*.json` reports written by `lhci collect` to
// `.lighthouseci/`. Output: a table of per-route JS/CSS transfer bytes
// (median of the cold runs), the FCP/LCP/TBT/CLS medians, and a pass/fail
// comparison against `perf-budgets.json`.
//
// The pure functions below are covered by `test/perf-budget.test.ts`; the
// command-line entry point only handles files, formatting, and exit codes.

import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const SCRIPT = "Script"
const STYLESHEET = "Stylesheet"
const LHR_FILE = /^lhr-.*\.json$/

const TIMING_AUDITS = [
  ["first-contentful-paint", "fcpMs"],
  ["largest-contentful-paint", "lcpMs"],
  ["total-blocking-time", "tbtMs"],
  ["cumulative-layout-shift", "cls"],
]

// Identify a run by the URL that was requested. `finalDisplayedUrl` follows
// client-side redirects (for example an auth bounce back to `/login`), and
// using it would file a failed authenticated run under the wrong route.
function reportUrl(report) {
  return (
    report.requestedUrl ?? report.finalUrl ?? report.finalDisplayedUrl ?? report.url
  )
}

/** The route key used by `perf-budgets.json`, e.g. `/dashboard/tasks`. */
export function routeFromUrl(url) {
  return new URL(url).pathname
}

/** Sums `transferSize` for one resource type in a Lighthouse report. */
export function sumTransferBytes(report, resourceType) {
  const items = report?.audits?.["network-requests"]?.details?.items
  if (!Array.isArray(items)) return 0

  return items.reduce((total, item) => {
    if (item?.resourceType !== resourceType) return total
    const bytes = Number(item.transferSize)
    return Number.isFinite(bytes) ? total + bytes : total
  }, 0)
}

/** Median of a non-empty numeric sample. Even samples average the middle pair. */
export function median(values) {
  if (!values.length) throw new Error("median requires at least one value")

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor((sorted.length - 1) / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle] + sorted[middle + 1]) / 2
}

function numericAudit(report, auditId) {
  const value = report?.audits?.[auditId]?.numericValue
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Lighthouse report ${reportUrl(report) ?? "<unknown>"} has no numeric value for "${auditId}"`
    )
  }
  return value
}

function performanceScore(report) {
  const score = report?.categories?.performance?.score
  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new Error(
      `Lighthouse report ${reportUrl(report) ?? "<unknown>"} has no performance score`
    )
  }
  return score
}

/**
 * Reduces the cold runs for one route to the median bytes and metrics.
 * Mixing reports from different routes is a harness bug, so it throws.
 */
export function summarizeReports(reports) {
  if (!reports.length) {
    throw new Error("summarizeReports requires at least one report")
  }

  const urls = new Set(reports.map(reportUrl))
  if (urls.size !== 1) {
    throw new Error(
      `Reports must share the same route: ${[...urls].join(", ")}`
    )
  }

  const url = [...urls][0]
  const medians = Object.fromEntries(
    TIMING_AUDITS.map(([auditId, key]) => [
      key,
      median(reports.map((report) => numericAudit(report, auditId))),
    ])
  )

  return {
    url,
    route: routeFromUrl(url),
    runs: reports.length,
    jsBytes: Math.round(
      median(reports.map((report) => sumTransferBytes(report, SCRIPT)))
    ),
    cssBytes: Math.round(
      median(reports.map((report) => sumTransferBytes(report, STYLESHEET)))
    ),
    performanceScore: median(reports.map(performanceScore)),
    ...medians,
  }
}

/**
 * Compares route summaries against the configured ceilings.
 * Returns one result per route with per-metric `passed` flags.
 */
export function compareToBudgets(summaries, budgets) {
  return summaries.map((summary) => {
    const budget = budgets[summary.route]
    if (!budget) {
      throw new Error(
        `No perf budget for "${summary.route}" in perf-budgets.json`
      )
    }

    const entries = ["jsBytes", "cssBytes"].map((metric) => {
      const ceiling = budget[metric]
      if (typeof ceiling !== "number" || !Number.isFinite(ceiling)) {
        throw new Error(
          `perf-budgets.json is missing a numeric "${metric}" ceiling for "${summary.route}"`
        )
      }

      return {
        metric,
        measured: summary[metric],
        ceiling,
        passed: summary[metric] <= ceiling,
      }
    })

    return {
      route: summary.route,
      passed: entries.every((entry) => entry.passed),
      entries,
    }
  })
}

function formatBytes(bytes) {
  return new Intl.NumberFormat("en-US").format(bytes)
}

function formatMs(value) {
  return `${Math.round(value)} ms`
}

function formatCls(value) {
  return value.toFixed(3)
}

function printSummary(summaries) {
  const header = [
    "Route".padEnd(22),
    "JS bytes".padStart(12),
    "CSS bytes".padStart(12),
    "FCP".padStart(10),
    "LCP".padStart(10),
    "TBT".padStart(10),
    "CLS".padStart(8),
    "Score".padStart(7),
  ].join("")

  process.stdout.write(`\nTiming medians (cold runs per route)\n\n${header}\n`)
  for (const summary of summaries) {
    const row = [
      summary.route.padEnd(22),
      formatBytes(summary.jsBytes).padStart(12),
      formatBytes(summary.cssBytes).padStart(12),
      formatMs(summary.fcpMs).padStart(10),
      formatMs(summary.lcpMs).padStart(10),
      formatMs(summary.tbtMs).padStart(10),
      formatCls(summary.cls).padStart(8),
      summary.performanceScore.toFixed(2).padStart(7),
    ].join("")
    process.stdout.write(`${row}\n`)
  }
  process.stdout.write("\n")
}

function printBudgets(comparisons) {
  process.stdout.write("Byte budgets (transferSize, median of runs)\n\n")
  process.stdout.write(
    `${"Route".padEnd(22)}${"Metric".padEnd(8)}${"Measured".padStart(12)}${"Ceiling".padStart(12)}   Result\n`
  )

  let failed = false
  for (const comparison of comparisons) {
    for (const entry of comparison.entries) {
      const result = entry.passed ? "PASS" : "FAIL"
      if (!entry.passed) failed = true
      process.stdout.write(
        `${comparison.route.padEnd(22)}${entry.metric === "jsBytes" ? "JS" : "CSS"}${"".padEnd(6)}${formatBytes(entry.measured).padStart(12)}${formatBytes(entry.ceiling).padStart(12)}   ${result}\n`
      )
    }
  }

  process.stdout.write("\n")
  return failed
}

function readReports(directory) {
  const reports = []
  for (const file of readdirSync(directory)) {
    if (!LHR_FILE.test(file)) continue
    reports.push(JSON.parse(readFileSync(join(directory, file), "utf8")))
  }
  return reports
}

function groupByRoute(reports) {
  const grouped = new Map()
  for (const report of reports) {
    const route = routeFromUrl(reportUrl(report))
    const runs = grouped.get(route) ?? []
    runs.push(report)
    grouped.set(route, runs)
  }
  return grouped
}

function parseArgs(argv) {
  const options = {
    reports: resolve(process.cwd(), ".lighthouseci"),
    budgets: resolve(process.cwd(), "perf-budgets.json"),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--reports") options.reports = resolve(argv[++index])
    else if (arg === "--budgets") options.budgets = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const budgets = JSON.parse(readFileSync(options.budgets, "utf8"))
  const grouped = groupByRoute(readReports(options.reports))

  const missingRoutes = Object.keys(budgets).filter(
    (route) => !grouped.has(route)
  )
  if (missingRoutes.length) {
    throw new Error(
      `No Lighthouse reports found for budgeted route(s): ${missingRoutes.join(", ")}`
    )
  }

  // Follow the budget file's route order so the output is stable.
  const summaries = Object.keys(budgets).map((route) =>
    summarizeReports(grouped.get(route))
  )
  const comparisons = compareToBudgets(summaries, budgets)

  printSummary(summaries)
  const failed = printBudgets(comparisons)

  if (failed) {
    process.stderr.write("Performance byte budget breached.\n")
    return 1
  }

  process.stdout.write("All byte budgets pass.\n")
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  }
}
