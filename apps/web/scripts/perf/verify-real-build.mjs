#!/usr/bin/env node
// Builds both deployment modes and proves the real-backend build excludes the
// mock backend:
//
//   1. mock build (no VITE_API_URL) — the artifact `pnpm perf` audits. It must
//      contain the dynamic MSW chunk and must not preload it.
//   2. real-backend build (VITE_API_URL set) into the gitignored `dist/real`.
//      It must contain no MSW worker/handlers chunk, no MSW runtime code in
//      any emitted script, and no preload/modulepreload reference to one.
//
// Vite-only builds are enough here: `pnpm typecheck` is a separate CI gate and
// this script asserts emitted assets. The outDir is gitignored so Tailwind's
// source scanner never sees it as a source tree.

import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { build } from "vite"

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
  }
}

export async function main() {
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

  const mockMsw = findMswManifestEntries(mock.manifest)
  process.stdout.write(
    `\nMock build: MSW chunk present (${mockMsw.join(", ")}), not preloaded.\n`
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
