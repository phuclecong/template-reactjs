#!/usr/bin/env node
// Builds both deployment modes and proves the real-backend build excludes the
// mock backend, and that the initial bundle respects its chunk contract:
//
//   1. mock build (no VITE_API_URL) — the artifact `pnpm perf` audits. It must
//      contain the dynamic MSW chunk and must not preload it. Its entry chunk
//      must be app code only and under 150 kB, no emitted chunk may exceed
//      500 kB, every vendor family must be intact, and `index.html` must
//      reference exactly the initial closure.
//   2. real-backend build (VITE_API_URL set) into the gitignored `dist/real`.
//      It must contain no MSW worker/handlers chunk, no MSW runtime code in
//      any emitted script, and no preload/modulepreload reference to one.
//
// Vite-only builds are enough here: `pnpm typecheck` is a separate CI gate and
// this script asserts emitted assets. The outDir is gitignored so Tailwind's
// source scanner never sees it as a source tree.

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { build } from "vite"

import {
  FORBIDDEN_IN_INITIAL,
  VENDOR_FAMILIES,
  VENDOR_GROUPS,
  isNodeModule,
  packageNameOf,
} from "./vendor-groups.mjs"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const MOCK_OUT_DIR = "dist"
const REAL_OUT_DIR = "dist/real"
const REAL_API_URL = "http://example.test/api"

const MSW_NAME = /msw|mock-worker|data-handlers/i
const MSW_MARKERS = [
  "mockServiceWorker",
  "setupWorker",
  "@mswjs/interceptors",
  "msw/browser",
  "dataHandlers",
]

/** Manifest entries that describe a mock-worker chunk (mock build only). */
export function findMswManifestEntries(manifest) {
  return Object.entries(manifest)
    .filter(([key, entry]) =>
      MSW_NAME.test(
        `${key} ${entry?.file ?? ""} ${entry?.name ?? ""} ${entry?.src ?? ""}`
      )
    )
    .map(([key]) => key)
    .sort()
}

/** MSW runtime markers present in an emitted script. */
export function findMswMarkersInSource(source) {
  return MSW_MARKERS.filter((marker) => source.includes(marker))
}

/** Script/link hrefs in index.html that point at a mock-worker asset. */
export function findMswReferencesInHtml(html) {
  const references = []
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const href = match[1]
    if (MSW_NAME.test(href)) references.push(href.split("/").pop())
  }
  return references
}

export const CHUNK_SIZE_LIMIT = 500_000
export const ENTRY_SIZE_LIMIT = 150_000
export const MAX_FAMILY_CHUNK_SIZE = 250_000

function assertNoProblems(title, problems) {
  if (problems.length) {
    throw new Error(`${title}:\n- ${problems.join("\n- ")}`)
  }
}

/** Problem message for an emitted chunk absent from the size map. */
function missingSizeProblem(file) {
  return `${file} has no recorded size`
}

/** Emitted JS chunks above the per-chunk byte limit, largest first. */
export function findOversizedChunks(chunkSizes, limit = CHUNK_SIZE_LIMIT) {
  return Object.entries(chunkSizes)
    .filter(([, bytes]) => Number.isFinite(bytes) && bytes > limit)
    .map(([file, bytes]) => ({ file, bytes }))
    .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file))
}

/** The chunk `index.html` loads, with the modules recorded in `report`. */
export function findEntryChunk(manifest, report) {
  const file = manifest?.["index.html"]?.file
  if (!file) return null
  return { file, modules: report?.[file] ?? [] }
}

/** Module ids that resolve into `node_modules`. */
export function findVendorModules(modules) {
  return modules.filter(isNodeModule).sort()
}

/** Chunk files reachable through static `imports` from `index.html`. */
export function initialClosure(manifest) {
  const visited = new Set()
  const files = new Set()

  const visit = (key) => {
    if (visited.has(key)) return
    visited.add(key)

    const entry = manifest?.[key]
    if (!entry) return
    if (entry.file) files.add(entry.file)
    for (const dependency of entry.imports ?? []) visit(dependency)
  }

  visit("index.html")
  return files
}

/** JS URLs referenced by `index.html`, normalized without the leading slash. */
export function findReferencedScripts(html) {
  const scripts = []
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)) {
    scripts.push(match[1].replace(/^\//, ""))
  }
  return [...new Set(scripts)].sort()
}

/**
 * Throws if a route-only package leaks into a chunk the entry loads, or if
 * `index.html` references anything other than the static import closure.
 */
export function assertInitialClosure({ manifest, html, report }) {
  const closure = initialClosure(manifest)
  const referenced = new Set(findReferencedScripts(html))
  const problems = []

  for (const file of [...closure].sort()) {
    for (const moduleId of report[file] ?? []) {
      const name = packageNameOf(moduleId)
      if (name && FORBIDDEN_IN_INITIAL.includes(name)) {
        problems.push(`${file} in the initial closure carries ${name}`)
      }
    }
    if (!referenced.has(file)) {
      problems.push(
        `initial-closure chunk ${file} has no preload; it would load as a waterfall`
      )
    }
  }

  for (const file of referenced) {
    if (!closure.has(file)) {
      problems.push(
        `index.html references ${file}, which is outside the initial closure`
      )
    }
  }

  assertNoProblems("Initial closure assertion failed", problems)
}

/** Every emitted chunk named after a vendor family, sorted. */
export function findFamilyChunks(report, family) {
  return Object.keys(report)
    .filter((file) => {
      const base = file.split("/").pop() ?? ""
      return base.startsWith(`${family}-`) && base.endsWith(".js")
    })
    .sort()
}

function vendorFamilyProblems(report, sizes) {
  const problems = []

  for (const group of VENDOR_GROUPS) {
    const files = findFamilyChunks(report, group.name)
    if (!files.length) {
      problems.push(`${group.name}: no emitted vendor chunk found`)
      continue
    }

    const label = group.name.replace(/^vendor-/, "")
    const containsFamily = files.some((file) =>
      (report[file] ?? []).some((moduleId) => group.test(moduleId))
    )
    if (!containsFamily) {
      problems.push(
        `${group.name} (${files.join(", ")}) contains no ${label} package`
      )
    }

    for (const file of files) {
      const bytes = sizes[file]
      if (!Number.isFinite(bytes)) {
        problems.push(missingSizeProblem(file))
      } else if (bytes > MAX_FAMILY_CHUNK_SIZE) {
        problems.push(
          `${group.name} (${file}) is ${bytes} B, above the ${MAX_FAMILY_CHUNK_SIZE} B family ceiling`
        )
      }
    }
  }

  return problems
}

/**
 * Throws unless every vendor family has at least one chunk, one of those
 * chunks contains a module from the family's packages, and every family chunk
 * is within the emitted-byte ceiling.
 */
export function assertVendorFamilies({ report, sizes }) {
  assertNoProblems(
    "Vendor family assertion failed",
    vendorFamilyProblems(report, sizes)
  )
}

/**
 * Throws unless the build has no oversized chunk, the entry chunk is app code
 * only and under its ceiling, and every vendor family is intact.
 */
export function assertChunkBoundaries({ manifest, report, sizes }) {
  const problems = []

  for (const chunk of findOversizedChunks(sizes)) {
    problems.push(
      `${chunk.file} is ${chunk.bytes} B, above the ${CHUNK_SIZE_LIMIT} B chunk limit`
    )
  }

  const entry = findEntryChunk(manifest, report)
  if (!entry) {
    problems.push("manifest has no index.html entry chunk")
  } else {
    const vendorModules = findVendorModules(entry.modules)
    if (vendorModules.length) {
      problems.push(
        `entry chunk ${entry.file} contains ${vendorModules.length} node_modules module(s), e.g. ${vendorModules[0]}`
      )
    }

    const bytes = sizes[entry.file]
    if (!Number.isFinite(bytes)) {
      problems.push(missingSizeProblem(entry.file))
    } else if (bytes >= ENTRY_SIZE_LIMIT) {
      problems.push(
        `entry chunk ${entry.file} is ${bytes} B, at or above the ${ENTRY_SIZE_LIMIT} B app-code ceiling`
      )
    }
  }

  problems.push(...vendorFamilyProblems(report, sizes))

  assertNoProblems("Chunk boundary assertion failed", problems)
}

function readManifest(outDir) {
  const path = join(APP_DIR, outDir, ".vite", "manifest.json")
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}; the ${outDir} build did not run`)
  }
  return JSON.parse(readFileSync(path, "utf8"))
}

function readHtml(outDir) {
  return readFileSync(join(APP_DIR, outDir, "index.html"), "utf8")
}

function readChunkReport(outDir) {
  const path = join(APP_DIR, outDir, ".vite", "chunk-report.json")
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}; the ${outDir} build did not emit a chunk report`
    )
  }
  return JSON.parse(readFileSync(path, "utf8"))
}

function readChunkSizes(outDir) {
  const assetsDir = join(APP_DIR, outDir, "assets")
  return Object.fromEntries(
    readdirSync(assetsDir)
      .filter((file) => file.endsWith(".js"))
      .map((file) => [
        `assets/${file}`,
        statSync(join(assetsDir, file)).size,
      ])
  )
}

function scanScripts(outDir) {
  const assetsDir = join(APP_DIR, outDir, "assets")
  return readdirSync(assetsDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({
      file,
      markers: findMswMarkersInSource(
        readFileSync(join(assetsDir, file), "utf8")
      ),
    }))
    .filter((result) => result.markers.length > 0)
}

/** Throws unless the mock build has and the real build lacks the mock backend. */
export function assertBuilds({
  mockManifest,
  mockHtml,
  mockScripts,
  realManifest,
  realHtml,
  realScripts,
}) {
  const mockEntries = findMswManifestEntries(mockManifest)
  if (!mockEntries.length) {
    throw new Error(
      "Mock build has no MSW chunk in the manifest; the real-build check would be vacuous."
    )
  }

  const mockPreloads = findMswReferencesInHtml(mockHtml)
  if (mockPreloads.length) {
    throw new Error(
      `Mock build preloads the MSW chunk (${mockPreloads.join(", ")}); it must stay request-time only.`
    )
  }

  if (
    !mockScripts.some((script) => script.markers.includes("mockServiceWorker"))
  ) {
    throw new Error(
      "Mock build has no emitted script with MSW runtime code; the real-build check would be vacuous."
    )
  }

  const realEntries = findMswManifestEntries(realManifest)
  if (realEntries.length) {
    throw new Error(
      `Real-backend build emitted MSW manifest entry/entries: ${realEntries.join(", ")}`
    )
  }

  const realPreloads = findMswReferencesInHtml(realHtml)
  if (realPreloads.length) {
    throw new Error(
      `Real-backend build references an MSW asset in index.html: ${realPreloads.join(", ")}`
    )
  }

  if (realScripts.length) {
    const detail = realScripts
      .map((script) => `${script.file} (${script.markers.join(", ")})`)
      .join("; ")
    throw new Error(`Real-backend build emits MSW runtime code: ${detail}`)
  }
}

async function buildMode(outDir, apiUrl) {
  if (apiUrl) process.env.VITE_API_URL = apiUrl
  else delete process.env.VITE_API_URL

  rmSync(join(APP_DIR, outDir), { recursive: true, force: true })
  process.stdout.write(
    `\nBuilding ${apiUrl ? "real-backend" : "mock"} mode into ${outDir}...\n`
  )
  await build({
    root: APP_DIR,
    configFile: join(APP_DIR, "vite.config.ts"),
    logLevel: "warn",
    build: { outDir },
  })
}

function collect(outDir) {
  return {
    manifest: readManifest(outDir),
    html: readHtml(outDir),
    scripts: scanScripts(outDir),
    report: readChunkReport(outDir),
    sizes: readChunkSizes(outDir),
  }
}

export async function main() {
  // The chunk report contains absolute module paths; emit it for this
  // verification build only, never for production builds.
  process.env.CHUNK_REPORT = "1"

  // The mock build is the audited one; run it first because its outDir
  // contains the real build's outDir.
  await buildMode(MOCK_OUT_DIR)
  await buildMode(REAL_OUT_DIR, REAL_API_URL)

  const mock = collect(MOCK_OUT_DIR)
  const real = collect(REAL_OUT_DIR)
  assertBuilds({
    mockManifest: mock.manifest,
    mockHtml: mock.html,
    mockScripts: mock.scripts,
    realManifest: real.manifest,
    realHtml: real.html,
    realScripts: real.scripts,
  })

  assertChunkBoundaries({
    manifest: mock.manifest,
    report: mock.report,
    sizes: mock.sizes,
  })
  assertInitialClosure({
    manifest: mock.manifest,
    html: mock.html,
    report: mock.report,
  })

  const mockMsw = findMswManifestEntries(mock.manifest)
  const entry = findEntryChunk(mock.manifest, mock.report)
  process.stdout.write(
    `\nMock build: MSW chunk present (${mockMsw.join(", ")}), not preloaded.\n`
  )
  process.stdout.write(
    `Mock build: entry ${entry.file} is ${mock.sizes[entry.file]} B and app-only; ` +
      `vendor chunks ${VENDOR_FAMILIES.join(", ")}; no chunk exceeds ${CHUNK_SIZE_LIMIT} B.\n`
  )
  process.stdout.write(
    "Real-backend build: no MSW chunk, no MSW runtime code, no MSW preload.\n"
  )
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .then((code) => {
      process.exitCode = code ?? 0
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
      process.exitCode = 1
    })
}
