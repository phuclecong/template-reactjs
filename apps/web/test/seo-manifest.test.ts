import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import type { ResolvedConfig } from "vite"

import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  TITLE_TEMPLATE,
  canonicalUrl,
  pageTitle,
  routeMetadata,
} from "../src/routes/route-metadata"
import { buildSeoManifest } from "../vite-plugins/seo-manifest"
import { seoMetadataPlugin } from "../vite-plugins/seo-metadata"

const SITE_URL = "https://dashboard.example"

const temporaryDirectories: string[] = []

function makeTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "seo-manifest-"))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("seo manifest", () => {
  const manifest = buildSeoManifest(SITE_URL)

  it("describes the same indexable routes as the typed table", () => {
    const indexable = Object.entries(routeMetadata)
      .filter(([, metadata]) => metadata.indexable)
      .map(([path]) => path)
      .sort()

    expect(manifest.routes.map((route) => route.path)).toEqual(indexable)
  })

  it("derives each route's copy and absolute canonical from the table", () => {
    for (const route of manifest.routes) {
      const metadata = routeMetadata[route.path]
      expect(route.title).toBe(pageTitle(metadata.title))
      expect(route.description).toBe(metadata.description)
      expect(route.canonical).toBe(canonicalUrl(route.path, SITE_URL))
      expect(route.robots).toBe("index, follow")
      expect(route.file).toBe(`${route.path.slice(1)}.html`)
      expect(route.canonical.startsWith(`${SITE_URL}/`)).toBe(true)
    }
  })

  it("carries the site and preview-image fields the build emits", () => {
    expect(manifest.siteUrl).toBe(SITE_URL)
    expect(manifest.site).toEqual({
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      titleTemplate: TITLE_TEMPLATE,
    })
    expect(manifest.ogImage).toEqual({
      path: OG_IMAGE_PATH,
      url: `${SITE_URL}${OG_IMAGE_PATH}`,
      alt: OG_IMAGE_ALT,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    })
    expect(manifest.catchAll).toEqual({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      robots: "noindex",
    })
  })

  it("is written to dist by the build plugin", async () => {
    const root = makeTemporaryDirectory()
    const outDir = "dist"
    mkdirSync(join(root, outDir), { recursive: true })
    writeFileSync(
      join(root, outDir, "index.html"),
      "<!doctype html><html><head><title>Dashboard</title></head><body></body></html>",
      "utf8"
    )

    const plugin = seoMetadataPlugin({ siteUrl: SITE_URL })
    plugin.configResolved?.call(
      plugin,
      {
        command: "build",
        root,
        build: { outDir },
        logger: { warn: () => undefined },
      } as unknown as ResolvedConfig
    )
    await plugin.closeBundle?.call(plugin, undefined as never)

    const written = JSON.parse(
      readFileSync(join(root, outDir, "seo-manifest.json"), "utf8")
    )
    expect(written).toEqual(buildSeoManifest(SITE_URL))
  })
})
