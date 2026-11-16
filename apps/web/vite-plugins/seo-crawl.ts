import type { RoutePath } from "../src/routes/route-paths"
import {
  canonicalUrl,
  resolveSiteUrl,
  routeMetadata,
  type RouteMetadata,
} from "../src/routes/route-metadata"

/**
 * Pure builders for the crawler files (`robots.txt`, `sitemap.xml`).
 *
 * Both derive from the same route table and canonical origin as the HTML head,
 * so a route cannot be indexable in one artifact and excluded in another.
 * Nothing here touches the filesystem or Vite, so it is unit-testable in Node.
 */

export const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character])
}

/** Indexable routes in a stable order, shared by the sitemap and tests. */
export function indexableRoutePaths(): RoutePath[] {
  return (
    Object.entries(routeMetadata) as [RoutePath, RouteMetadata][]
  )
    .filter(([, metadata]) => metadata.indexable)
    .map(([path]) => path)
    .sort()
}

/**
 * The crawl rule for the whole origin. The dashboard prefix is also excluded
 * by the host's `X-Robots-Tag` header, so exclusion does not depend on a
 * crawler honouring this file alone.
 */
export function buildRobotsTxt(siteUrl: string): string {
  const origin = resolveSiteUrl(siteUrl)
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n")
}

/**
 * Exactly the indexable routes as absolute URLs, taken from `canonicalUrl` so
 * each `<loc>` is byte-identical to the page's canonical link. No `lastmod`:
 * the content has no real modification time to report.
 */
export function buildSitemapXml(siteUrl: string): string {
  const origin = resolveSiteUrl(siteUrl)
  const urls = indexableRoutePaths().map((path) => {
    const loc = escapeXml(canonicalUrl(path, origin))
    return `  <url>\n    <loc>${loc}</loc>\n  </url>`
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${SITEMAP_NAMESPACE}">`,
    ...urls,
    "</urlset>",
    "",
  ].join("\n")
}

/** Every crawler file, keyed by its name in the build output. */
export function buildCrawlFiles(siteUrl: string): Record<string, string> {
  return {
    "robots.txt": buildRobotsTxt(siteUrl),
    "sitemap.xml": buildSitemapXml(siteUrl),
  }
}

export type CrawlFile = {
  body: string
  contentType: string
}

/**
 * Resolves a request pathname to its crawler file, or null when the request is
 * not one of them. The dev middleware uses the same resolution as the build.
 */
export function crawlFileForPath(
  pathname: string,
  siteUrl: string
): CrawlFile | null {
  if (pathname === "/robots.txt") {
    return {
      body: buildRobotsTxt(siteUrl),
      contentType: "text/plain; charset=utf-8",
    }
  }
  if (pathname === "/sitemap.xml") {
    return {
      body: buildSitemapXml(siteUrl),
      contentType: "application/xml; charset=utf-8",
    }
  }
  return null
}
