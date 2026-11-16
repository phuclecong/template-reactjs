import { readFile, writeFile } from "node:fs/promises"
import type { IncomingMessage } from "node:http"
import { join, resolve } from "node:path"

import type { Plugin, ResolvedConfig } from "vite"

import {
  buildPublicHead,
  buildRouteDocuments,
  indexableRoutePath,
  transformHead,
} from "../src/seo/head"
import { buildCrawlFiles, crawlFileForPath } from "./seo-crawl"
import { SEO_MANIFEST_FILE, serializeSeoManifest } from "./seo-manifest"
import { DEFAULT_SITE_URL, resolveSiteUrl } from "./site-url"

export type SeoMetadataPluginOptions = {
  /** Overrides `SITE_URL`; intended for tests and embedders. */
  siteUrl?: string
}

function readSiteUrl(options: SeoMetadataPluginOptions): string | undefined {
  return options.siteUrl ?? process.env.SITE_URL
}

/**
 * Dev requests describe the origin the browser is actually on when `SITE_URL`
 * is unset, so raw dev HTML carries a canonical for the dev server rather than
 * the build fallback.
 */
function requestOrigin(
  request: IncomingMessage,
  options: SeoMetadataPluginOptions
): string {
  const configured = readSiteUrl(options)?.trim()
  if (configured) return resolveSiteUrl(configured)

  const host = request.headers.host
  if (!host) return DEFAULT_SITE_URL

  const forwardedProto = request.headers["x-forwarded-proto"]
  const socket = request.socket as { encrypted?: boolean }
  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0].trim()
      : socket.encrypted
        ? "https"
        : "http"

  return `${protocol}://${host}`
}

/**
 * Emits per-route metadata for the indexable surface.
 *
 * - Build: reads the built `dist/index.html`, rewrites its head as the
 *   catch-all (`noindex`, no canonical), writes one flat HTML document per
 *   indexable route (`login.html`, `register.html`), and writes `robots.txt`,
 *   `sitemap.xml`, and `seo-manifest.json` from the same route table and
 *   origin. The body is untouched.
 * - Dev: serves the same head for an indexable path through the same builder,
 *   after Vite's own HTML processing injects the client and HMR preamble, so
 *   view-source without JavaScript matches the build. The crawler files are
 *   served from the same builders, so they never fall through to `index.html`.
 *
 * `SITE_URL` is read here, in Node, and never enters the client bundle. The
 * build resolves it once and passes the concrete origin to every builder.
 */
export function seoMetadataPlugin(
  options: SeoMetadataPluginOptions = {}
): Plugin {
  let config: ResolvedConfig
  const siteUrl = resolveSiteUrl(readSiteUrl(options))

  return {
    name: "seo-route-metadata",

    configResolved(resolved) {
      config = resolved

      if (resolved.command === "build" && !readSiteUrl(options)?.trim()) {
        resolved.logger.warn(
          `[seo] SITE_URL is not set; using ${DEFAULT_SITE_URL}. ` +
            "Set SITE_URL to the canonical origin before deploying."
        )
      }
    },

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const isHead = request.method === "HEAD"
        if (request.method !== "GET" && !isHead) return next()

        const origin = requestOrigin(request, options)
        const pathname = new URL(request.url ?? "/", "http://localhost")
          .pathname
        const crawlFile = crawlFileForPath(pathname, origin)
        if (crawlFile) {
          response.statusCode = 200
          response.setHeader("Content-Type", crawlFile.contentType)
          response.end(isHead ? undefined : crawlFile.body)
          return
        }

        if (isHead) return next()
        const path = indexableRoutePath(pathname)
        if (!path) return next()

        void (async () => {
          try {
            const indexHtml = await readFile(
              join(config.root, "index.html"),
              "utf8"
            )
            const transformed = await server.transformIndexHtml(
              request.url ?? pathname,
              indexHtml
            )
            const html = transformHead(
              transformed,
              buildPublicHead(path, origin)
            )

            response.statusCode = 200
            response.setHeader("Content-Type", "text/html; charset=utf-8")
            response.end(html)
          } catch (error) {
            next(error)
          }
        })()
      })
    },

    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir)
      const built = await readFile(join(outDir, "index.html"), "utf8")
      const documents = buildRouteDocuments(built, siteUrl)
      const crawlFiles = buildCrawlFiles(siteUrl)

      await Promise.all(
        [
          ...Object.entries(documents),
          ...Object.entries(crawlFiles),
          [SEO_MANIFEST_FILE, serializeSeoManifest(siteUrl)],
        ].map(([name, content]) => writeFile(join(outDir, name), content))
      )
    },
  }
}
