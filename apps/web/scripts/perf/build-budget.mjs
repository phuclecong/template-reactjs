#!/usr/bin/env node
// Byte-budget calculator measured from the production build itself.
//
// Input: `dist/.vite/manifest.json` and the emitted assets. No browser and no
// Lighthouse report are involved, so the check is deterministic and runs in
// milliseconds after `vite build`.
//
// Per route, the measured bytes are the gzipped size of everything the route
// downloads to render:
//
//   JS  = static `imports` closure of `index.html`
//       + static `imports` closure of the route's lazy chunk
//   CSS = every stylesheet referenced by those chunks
//
// Nested dynamic imports (for example the task dialogs) load on interaction
// and are excluded, as is the request-time mock worker (`src/utils/msw.ts`):
// neither is part of the route's static render path. HTTP headers are not
// counted either; this is compressed body bytes only.
//
// The pure functions below are covered by `test/perf-build-budget.test.ts`; the
// command-line entry point only handles files, formatting, and exit codes.

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

import { budgetedRoutes, compareToBudgets, printBudgets } from "./budget.mjs"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const DEFAULT_DIST = "dist"
const ROUTE_LOADERS_FILE = join(APP_DIR, "src/routes/route-loaders.ts")

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

/** Vite manifest key for a route path: `/tasks` -> `src/routes/tasks.tsx`. */
export function routeSourceKey(route) {
  return `src/routes/${route.replace(/^\//, "")}.tsx`
}

/**
 * Manifest keys reachable through static `imports` from `roots`.
 * `dynamicImports` are not followed: they are interaction-time code.
 */
export function staticClosure(manifest, roots) {
  const seen = new Set()
  const visit = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    for (const dependency of manifest[key]?.imports ?? []) visit(dependency)
  }

  for (const root of roots) visit(root)
  return seen
}

/**
 * Emitted scripts and stylesheets a route downloads to render, sorted and
 * deduplicated across the shared entry closure and the route's own chunk.
 */
export function routeAssets(manifest, route) {
  const sourceKey = routeSourceKey(route)
  if (!Object.hasOwn(manifest, sourceKey)) {
    throw new Error(
      `Manifest has no entry "${sourceKey}" for route "${route}"; the route is not lazily imported from App or the build is stale.`
    )
  }

  const scripts = new Set()
  const stylesheets = new Set()
  for (const key of staticClosure(manifest, ["index.html", sourceKey])) {
    const entry = manifest[key]
    if (!entry) continue
    if (entry.file?.endsWith(".js")) scripts.add(entry.file)
    for (const stylesheet of entry.css ?? []) stylesheets.add(stylesheet)
  }

  return {
    scripts: [...scripts].sort(),
    stylesheets: [...stylesheets].sort(),
  }
}

function sumBytes(files, fileBytes) {
  return files.reduce((total, file) => total + fileBytes(file), 0)
}

/** Byte summary for one route, in the shape `compareToBudgets` expects. */
export function summarizeRoute(manifest, route, fileBytes) {
  const { scripts, stylesheets } = routeAssets(manifest, route)
  return {
    route,
    jsBytes: sumBytes(scripts, fileBytes),
    cssBytes: sumBytes(stylesheets, fileBytes),
  }
}

export function summarizeBuild({ manifest, routes, fileBytes }) {
  return routes.map((route) => summarizeRoute(manifest, route, fileBytes))
}

function parseArgs(argv) {
  const options = {
    dist: DEFAULT_DIST,
    budgets: join(APP_DIR, "perf-budgets.json"),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--dist") options.dist = argv[++index]
    else if (arg === "--budgets") options.budgets = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const distDir = resolve(APP_DIR, options.dist)
  const manifest = JSON.parse(
    readFileSync(join(distDir, ".vite", "manifest.json"), "utf8")
  )
  const budgets = JSON.parse(readFileSync(options.budgets, "utf8"))
  const routes = resolveRoutes()

  process.stdout.write(`Routes: ${routes.join(", ")}\n`)

  const summaries = summarizeBuild({
    manifest,
    routes,
    fileBytes: (file) => gzipSync(readFileSync(join(distDir, file))).length,
  })

  const missingRoutes = budgetedRoutes(budgets).filter(
    (route) => !summaries.some((summary) => summary.route === route)
  )
  if (missingRoutes.length) {
    throw new Error(
      `No build chunk found for budgeted route(s): ${missingRoutes.join(", ")}`
    )
  }

  const failed = printBudgets(
    compareToBudgets(summaries, budgets),
    "Byte budgets (gzip bytes of the route's static JS/CSS closure)"
  )

  if (failed) {
    process.stderr.write("Performance byte budget breached.\n")
    return 1
  }

  process.stdout.write("All byte budgets pass.\n")
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  }
}
