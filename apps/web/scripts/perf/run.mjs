#!/usr/bin/env node
// Production performance harness entry point for `pnpm perf`.
//
// 1. Build the web app (`tsc -b && vite build`).
// 2. Serve the build with `vite preview` on port 4173 (never `vite dev`).
// 3. Run Lighthouse mobile three times per route, one fresh browser per run.
// 4. Assert the median thresholds with LHCI.
// 5. Compare per-route JS/CSS transfer bytes against perf-budgets.json and
//    print the FCP/LCP/TBT/CLS medians.

import { spawn } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const PREVIEW_PORT = 4173
const BASE_URL = `http://localhost:${PREVIEW_PORT}`
const RUNS_PER_ROUTE = 1
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
const ROUTE_LOADERS_FILE = appPath("src/routes/route-loaders.ts")

/**
 * Auditable routes come from the app's own `routeLoaders` map, so adding a
 * route cannot silently leave it unmeasured. The file is parsed instead of
 * imported: it is TypeScript, and its `@/` aliases only resolve inside the
 * Vite build. `typescript` is a dev dependency the `pnpm run build` step
 * already requires.
 */
export function resolveRoutes() {
  const typescript = createRequire(import.meta.url)("typescript")
  const sourceFile = typescript.createSourceFile(
    ROUTE_LOADERS_FILE,
    readFileSync(ROUTE_LOADERS_FILE, "utf8"),
    typescript.ScriptTarget.Latest,
    true
  )

  for (const statement of sourceFile.statements) {
    if (!typescript.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!typescript.isIdentifier(declaration.name)) continue
      if (declaration.name.text !== "routeLoaders") continue

      // The initializer is wrapped by `satisfies Record<...>`; unwrap to the
      // object literal whose top-level keys are the route paths.
      let initializer = declaration.initializer
      while (
        initializer &&
        (typescript.isSatisfiesExpression(initializer) ||
          typescript.isAsExpression(initializer) ||
          typescript.isParenthesizedExpression(initializer))
      ) {
        initializer = initializer.expression
      }
      if (!initializer || !typescript.isObjectLiteralExpression(initializer))
        continue

      const routes = initializer.properties
        .filter(typescript.isPropertyAssignment)
        .map((property) => property.name)
        .filter(typescript.isStringLiteralLike)
        .map((name) => name.text)

      if (routes.length === 0) continue
      return routes
    }
  }

  throw new Error(
    `Could not read route paths from ${ROUTE_LOADERS_FILE}; expected an object literal named "routeLoaders".`
  )
}

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
      cwd: APP_DIR,
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
  process.stdout.write(
    `\n$ ${process.execPath} ${VITE_CLI} preview --port ${PREVIEW_PORT} --strictPort\n`
  )
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
  throw new Error(
    `vite preview did not respond at ${url} within ${timeoutMs} ms`
  )
}

function stopPreview(preview) {
  if (!preview || preview.exitCode !== null) return
  preview.kill("SIGTERM")
}

async function main() {
  const chromePath = resolveChromePath()
  const env = { CHROME_PATH: chromePath }
  process.stdout.write(`Chrome: ${chromePath}\n`)

  const routes = resolveRoutes()
  process.stdout.write(`Routes: ${routes.join(", ")}\n`)

  const buildCode = await run(pnpm, ["run", "build"])
  if (buildCode !== 0) return buildCode

  // Start from a clean report directory; every collect below is additive.
  rmSync(REPORTS_DIR, { recursive: true, force: true })

  const preview = startPreview()
  preview.on("error", (error) => {
    process.stderr.write(`vite preview failed: ${error.message}\n`)
  })

  let failed = false
  try {
    await waitForServer(preview, `${BASE_URL}${routes[0]}`, SERVER_TIMEOUT_MS)

    for (const route of routes) {
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

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    })
}
