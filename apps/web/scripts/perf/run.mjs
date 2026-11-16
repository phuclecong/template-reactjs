#!/usr/bin/env node
// Production performance harness entry point for `pnpm perf`.
//
// 1. Build the web app (`tsc -b && vite build`).
// 2. Serve the build with `vite preview` on port 4173 (never `vite dev`).
// 3. Run Lighthouse mobile three times per performance route, one fresh
//    browser per run.
// 4. Assert the median thresholds with LHCI.
// 5. Compare per-route JS/CSS transfer bytes against perf-budgets.json and
//    print the FCP/LCP/TBT/CLS medians.
// 6. Run one cold Lighthouse SEO audit per public route, assert a perfect
//    score, and name any failing audit. SEO has no timing component, so it
//    deliberately uses one run instead of the performance three-run rule.

import { spawn } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const PREVIEW_PORT = 4173
const BASE_URL = `http://localhost:${PREVIEW_PORT}`
const ROUTES = ["/login", "/dashboard/tasks"]
const RUNS_PER_ROUTE = 3
// The indexable surface (seo.md §3/§6). One cold run per route: the SEO score
// has no timing component, so the performance three-run rule does not apply.
const SEO_ROUTES = ["/login", "/register"]
const SEO_RUNS_PER_ROUTE = 1
const SERVER_TIMEOUT_MS = 60_000

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

function appPath(...parts) {
  return join(APP_DIR, ...parts)
}

function requireScript(specifier, fallbackPath) {
  try {
    return createRequire(import.meta.url).resolve(specifier)
  } catch {
    return fallbackPath
  }
}

const LHCI_CLI = requireScript(
  "@lhci/cli/src/cli.js",
  appPath("node_modules/@lhci/cli/src/cli.js")
)
const VITE_CLI = requireScript(
  "vite/bin/vite.js",
  appPath("node_modules/vite/bin/vite.js")
)
const BUDGET_SCRIPT = appPath("scripts/perf/budget.mjs")
const REPORTS_DIR = appPath(".lighthouseci")
// Separate config and working directory: SEO reports must not enter the
// performance assertions or the byte-budget calculation. LHCI always writes
// to `<cwd>/.lighthouseci`, so the SEO collect/assert commands run with this
// directory as their cwd and keep their reports under
// `.lighthouseci-seo/.lighthouseci`.
const SEO_CONFIG = appPath("lighthouserc.seo.cjs")
const SEO_REPORTS_DIR = appPath(".lighthouseci-seo")
const SEO_LHCI_DIR = join(SEO_REPORTS_DIR, ".lighthouseci")

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH

  // Prefer the Playwright Chromium the repo already installs for e2e/Storybook
  // tests; CI installs it explicitly for the perf job.
  try {
    const require = createRequire(import.meta.url)
    const { chromium } = require("@playwright/test")
    const executablePath = chromium.executablePath()
    if (executablePath && existsSync(executablePath)) return executablePath
  } catch {
    // Fall through to a system Chrome installation.
  }

  const candidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ],
    win32: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ],
  }
  const found = (candidates[process.platform] ?? []).find(existsSync)
  if (found) return found

  throw new Error(
    "No Chrome/Chromium found. Install Playwright Chromium (`pnpm --filter web exec playwright install chromium`) or set CHROME_PATH."
  )
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    process.stdout.write(`\n$ ${[command, ...args].join(" ")}\n`)
    const child = spawn(command, args, {
      cwd: options.cwd ?? APP_DIR,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
    })
    child.on("error", (error) => {
      process.stderr.write(`${error.message}\n`)
      resolve(1)
    })
    child.on("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0))
    })
  })
}

function startPreview() {
  process.stdout.write(`\n$ ${process.execPath} ${VITE_CLI} preview --port ${PREVIEW_PORT} --strictPort\n`)
  return spawn(
    process.execPath,
    [VITE_CLI, "preview", "--port", String(PREVIEW_PORT), "--strictPort"],
    { cwd: APP_DIR, stdio: "inherit", env: process.env }
  )
}

async function waitForServer(preview, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(
        `vite preview exited with code ${preview.exitCode} before serving ${url}`
      )
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The preview server has not bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`vite preview did not respond at ${url} within ${timeoutMs} ms`)
}

function stopPreview(preview) {
  if (!preview || preview.exitCode !== null) return
  preview.kill("SIGTERM")
}

function seoReportRoute(report) {
  return new URL(
    report.requestedUrl ?? report.finalUrl ?? report.finalDisplayedUrl
  ).pathname
}

/** Scored SEO audits that did not earn a perfect score, with their weight. */
function failingSeoAudits(report) {
  const refs = report?.categories?.seo?.auditRefs
  if (!Array.isArray(refs)) return []

  return refs
    .filter((ref) => Number(ref.weight) > 0)
    .map((ref) => ({ id: ref.id, audit: report.audits?.[ref.id] }))
    .filter(
      ({ audit }) =>
        typeof audit?.score === "number" && audit.score < 1
    )
    .map(({ id, audit }) => `${id} (${audit.title}, score ${audit.score})`)
}

/**
 * Reads the collected SEO reports, prints the score per route, and returns 1
 * if any route scored below 1.0. A perfect category score can still hide a
 * failing audit only if that audit carries no weight; this names every
 * weighted audit that lost points.
 */
function reportSeoSummary(directory) {
  const files = existsSync(directory)
    ? readdirSync(directory).filter((file) => /^lhr-.*\.json$/.test(file))
    : []

  if (files.length === 0) {
    process.stderr.write(
      `\nNo SEO Lighthouse reports found in ${directory}.\n`
    )
    return 1
  }

  let failed = false
  process.stdout.write(
    `\nLighthouse SEO scores (one cold run per public route)\n\n` +
      `${"Route".padEnd(22)}${"Score".padStart(7)}   Result\n`
  )

  for (const file of files) {
    const report = JSON.parse(readFileSync(join(directory, file), "utf8"))
    const route = seoReportRoute(report)
    const score = report?.categories?.seo?.score
    const passed = typeof score === "number" && score >= 1
    if (!passed) failed = true

    process.stdout.write(
      `${route.padEnd(22)}${typeof score === "number" ? score.toFixed(2).padStart(7) : "n/a".padStart(7)}   ${passed ? "PASS" : "FAIL"}\n`
    )

    if (!passed) {
      const audits = failingSeoAudits(report)
      process.stderr.write(
        `SEO ${route} scored ${typeof score === "number" ? score : "no score"}; failing audit(s): ${
          audits.length ? audits.join(", ") : "none reported (check the category)"
        }\n`
      )
    }
  }

  return failed ? 1 : 0
}

async function main() {
  const chromePath = resolveChromePath()
  const env = { CHROME_PATH: chromePath }
  process.stdout.write(`Chrome: ${chromePath}\n`)

  const buildCode = await run(pnpm, ["run", "build"])
  if (buildCode !== 0) return buildCode

  // Start from clean report directories; every collect below is additive.
  rmSync(REPORTS_DIR, { recursive: true, force: true })
  rmSync(SEO_REPORTS_DIR, { recursive: true, force: true })
  mkdirSync(SEO_REPORTS_DIR, { recursive: true })

  const preview = startPreview()
  preview.on("error", (error) => {
    process.stderr.write(`vite preview failed: ${error.message}\n`)
  })

  let failed = false
  try {
    await waitForServer(preview, `${BASE_URL}/login`, SERVER_TIMEOUT_MS)

    for (const route of ROUTES) {
      for (let runIndex = 1; runIndex <= RUNS_PER_ROUTE; runIndex += 1) {
        process.stdout.write(
          `\n=== ${route} cold run ${runIndex}/${RUNS_PER_ROUTE} ===\n`
        )
        const code = await run(
          process.execPath,
          [
            LHCI_CLI,
            "collect",
            "--config=./lighthouserc.cjs",
            `--url=${BASE_URL}${route}`,
            "--numberOfRuns=1",
            "--additive",
          ],
          { env }
        )
        if (code !== 0) failed = true
      }
    }

    process.stdout.write("\n=== Lighthouse median assertions ===\n")
    const assertCode = await run(process.execPath, [
      LHCI_CLI,
      "assert",
      "--config=./lighthouserc.cjs",
      "--includePassedAssertions",
    ])
    if (assertCode !== 0) failed = true

    process.stdout.write("\n=== Byte budgets and timing medians ===\n")
    const budgetCode = await run(process.execPath, [
      BUDGET_SCRIPT,
      "--reports",
      REPORTS_DIR,
      "--budgets",
      appPath("perf-budgets.json"),
    ])
    if (budgetCode !== 0) failed = true

    // SEO pass: one cold run per public route. It uses its own config and
    // report directory so the performance assertions and byte budgets above
    // stay exactly as they were.
    for (const route of SEO_ROUTES) {
      for (let runIndex = 1; runIndex <= SEO_RUNS_PER_ROUTE; runIndex += 1) {
        process.stdout.write(
          `\n=== SEO ${route} cold run ${runIndex}/${SEO_RUNS_PER_ROUTE} ===\n`
        )
        const code = await run(
          process.execPath,
          [
            LHCI_CLI,
            "collect",
            `--config=${SEO_CONFIG}`,
            `--url=${BASE_URL}${route}`,
            "--numberOfRuns=1",
            "--additive",
          ],
          { env, cwd: SEO_REPORTS_DIR }
        )
        if (code !== 0) failed = true
      }
    }

    const seoSummaryCode = reportSeoSummary(SEO_LHCI_DIR)
    if (seoSummaryCode !== 0) failed = true

    process.stdout.write("\n=== Lighthouse SEO assertions ===\n")
    const seoAssertCode = await run(
      process.execPath,
      [
        LHCI_CLI,
        "assert",
        `--config=${SEO_CONFIG}`,
        "--includePassedAssertions",
      ],
      { cwd: SEO_REPORTS_DIR }
    )
    if (seoAssertCode !== 0) failed = true
  } finally {
    stopPreview(preview)
  }

  if (failed) {
    process.stderr.write("\nPerformance harness failed.\n")
    return 1
  }

  process.stdout.write("\nPerformance harness passed.\n")
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  })
