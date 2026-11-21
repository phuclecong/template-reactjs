#!/usr/bin/env node
// Production performance harness entry point for `pnpm perf`.
//
// 1. Build the web app (`tsc -b && vite build`).
// 2. Compare the build's per-route JS/CSS bytes against perf-budgets.json.
//
// The byte budgets are measured from the emitted assets, not from a Lighthouse
// report (`scripts/perf/build-budget.mjs`), so the harness needs no browser and
// no preview server. Lighthouse collection and assertions are disabled for now;
// `lighthouserc.cjs` and `scripts/perf/login.cjs` are kept for that pass.

import { spawn } from "node:child_process"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const BUDGET_SCRIPT = join(APP_DIR, "scripts/perf/build-budget.mjs")

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

function appPath(...parts) {
  return join(APP_DIR, ...parts)
}

function run(command, args) {
  return new Promise((resolve) => {
    process.stdout.write(`\n$ ${[command, ...args].join(" ")}\n`)
    const child = spawn(command, args, { cwd: APP_DIR, stdio: "inherit" })
    child.on("error", (error) => {
      process.stderr.write(`${error.message}\n`)
      resolve(1)
    })
    child.on("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0))
    })
  })
}

async function main() {
  const buildCode = await run(pnpm, ["run", "build"])
  if (buildCode !== 0) return buildCode

  process.stdout.write("\n=== Byte budgets ===\n")
  const budgetCode = await run(process.execPath, [
    BUDGET_SCRIPT,
    "--dist",
    "dist",
    "--budgets",
    appPath("perf-budgets.json"),
  ])
  if (budgetCode !== 0) {
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
