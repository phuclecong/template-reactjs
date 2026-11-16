import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import type { Plugin, ResolvedConfig } from "vite"

import { DEFAULT_SITE_URL, resolveSiteUrl } from "../src/routes/route-metadata"
import { buildCrawlFiles, crawlFileForPath } from "./seo-crawl"
import {
  buildPublicHead,
  buildRouteDocuments,
  publicRoutePath,
  transformHead,
} from "./seo-head"

export type SeoMetadataPluginOptions = {
  /** Overrides `SITE_URL`; intended for tests and embedders. */
  siteUrl?: string
}

function readSiteUrl(options: SeoMetadataPluginOptions): string | undefined {
  return options.siteUrl ?? process.env.SITE_URL
}

/**
 * Emits per-route metadata for the indexable surface.
 *
 * - Build: reads the built `dist/index.html`, rewrites its head as the
 *   catch-all (`noindex`, no canonical), writes one flat HTML document per
 *   indexable route (`login.html`, `register.html`), and writes `robots.txt`
 *   and `sitemap.xml` from the same route table and origin. The body is
 *   untouched.
 * - Dev: serves the same head for an indexable path through the same builder,
 *   after Vite's own HTML processing injects the client and HMR preamble, so
 *   view-source without JavaScript matches the build. The crawler files are
 *   served from the same builders, so they never fall through to `index.html`.
 *
 * `SITE_URL` is read here, in Node, and never enters the client bundle.
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

        const pathname = new URL(request.url ?? "/", "http://localhost")
          .pathname
        const crawlFile = crawlFileForPath(pathname, siteUrl)
        if (crawlFile) {
          response.statusCode = 200
          response.setHeader("Content-Type", crawlFile.contentType)
          response.end(isHead ? undefined : crawlFile.body)
          return
        }

        if (isHead) return next()
        const path = publicRoutePath(pathname)
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
              buildPublicHead(path, siteUrl)
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
        ].map(([name, content]) => writeFile(join(outDir, name), content))
      )
    },
  }
}
