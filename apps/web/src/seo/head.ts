import type { RoutePath } from "../routes/route-paths"
import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  canonicalUrl,
  pageTitle,
  routeMetadata,
  type RouteMetadata,
} from "../routes/route-metadata"

/**
 * Pure Page metadata builders shared by the build plugin and the client.
 * Nothing here touches the filesystem, Vite, or the browser, so it is
 * unit-testable in Node and the same function renders production HTML and
 * dev view-source.
 *
 * Every emitted tag carries a stable `data-seo` key. The client reconciliation
 * component updates tags by that key, so it must not be renamed casually.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])
}

function titleTag(title: string): string {
  return `<title data-seo="title">${escapeHtml(title)}</title>`
}

function metaName(name: string, content: string, key: string): string {
  return `<meta name="${name}" content="${escapeHtml(content)}" data-seo="${key}" />`
}

function metaProperty(property: string, content: string, key: string): string {
  return `<meta property="${property}" content="${escapeHtml(content)}" data-seo="${key}" />`
}

function canonicalTag(href: string): string {
  return `<link rel="canonical" href="${escapeHtml(href)}" data-seo="canonical" />`
}

function robotsTag(directive: string): string {
  return `<meta name="robots" content="${directive}" data-seo="robots" />`
}

/**
 * Serializes JSON-LD and escapes the characters that could close the script
 * element or be read as markup, while keeping the result valid JSON.
 */
function jsonLdTag(payload: unknown): string {
  const json = JSON.stringify(payload)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
  return `<script type="application/ld+json" data-seo="json-ld">${json}</script>`
}

function socialTags({
  title,
  description,
  url,
  siteUrl,
}: {
  title: string
  description: string
  url?: string
  siteUrl: string
}): string[] {
  // The image is origin-level, so it is referenced by absolute URL on every
  // document. It lives in `public/` and is metadata-only: no page request.
  const imageUrl = absoluteUrl(OG_IMAGE_PATH, siteUrl)
  const tags = [
    metaProperty("og:title", title, "og:title"),
    metaProperty("og:description", description, "og:description"),
  ]
  if (url) tags.push(metaProperty("og:url", url, "og:url"))
  tags.push(
    metaProperty("og:type", "website", "og:type"),
    metaProperty("og:site_name", SITE_NAME, "og:site_name"),
    metaProperty("og:image", imageUrl, "og:image"),
    metaProperty("og:image:alt", OG_IMAGE_ALT, "og:image:alt"),
    metaProperty("og:image:width", String(OG_IMAGE_WIDTH), "og:image:width"),
    metaProperty("og:image:height", String(OG_IMAGE_HEIGHT), "og:image:height"),
    metaName("twitter:card", "summary_large_image", "twitter:card"),
    metaName("twitter:title", title, "twitter:title"),
    metaName("twitter:description", description, "twitter:description"),
    metaName("twitter:image", imageUrl, "twitter:image")
  )
  return tags
}

/**
 * Resolves a request pathname to an indexable route, or null when the dev
 * middleware should leave the request to Vite (protected and unknown paths
 * keep the client-rendered catch-all).
 */
export function indexableRoutePath(pathname: string): RoutePath | null {
  if (!Object.hasOwn(routeMetadata, pathname)) return null
  const path = pathname as RoutePath
  return routeMetadata[path].indexable ? path : null
}

/** Head for an indexable route, emitted as its own HTML document. */
export function buildPublicHead(path: RoutePath, siteUrl: string): string {
  const metadata = routeMetadata[path]
  const canonical = canonicalUrl(path, siteUrl)
  const title = pageTitle(metadata.title)

  return [
    titleTag(title),
    metaName("description", metadata.description, "description"),
    canonicalTag(canonical),
    robotsTag("index, follow"),
    ...socialTags({
      title,
      description: metadata.description,
      url: canonical,
      siteUrl,
    }),
    jsonLdTag({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      description: metadata.description,
      url: canonical,
    }),
  ].join("\n")
}

/**
 * Head for the catch-all document. It serves the dashboard, `/`, and unknown
 * paths, so it cannot assert a canonical URL or og:url for any of them.
 */
export function buildCatchAllHead(siteUrl: string): string {
  return [
    titleTag(SITE_NAME),
    metaName("description", SITE_DESCRIPTION, "description"),
    robotsTag("noindex"),
    ...socialTags({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      siteUrl,
    }),
  ].join("\n")
}

const HEAD_PATTERN = /(<head[^>]*>)([\s\S]*?)(<\/head>)/i

// Tags a previous build or the HTML template may already carry. Removing them
// before injecting keeps exactly one tag per `data-seo` key.
const STALE_TAG_PATTERNS = [
  /<title\b[^>]*>[\s\S]*?<\/title>/gi,
  /<meta\b[^>]*\b(?:name|property)="(?:description|robots|og:[^"]*|twitter:[^"]*)"[^>]*>/gi,
  /<link\b[^>]*\brel="canonical"[^>]*>/gi,
  /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
]

function headLines(head: string): string[] {
  let stripped = head
  for (const pattern of STALE_TAG_PATTERNS)
    stripped = stripped.replace(pattern, "")
  return stripped
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Replaces the Page metadata portion of a document's head, preserving
 * everything else Vite emitted (stylesheets, module preloads, the entry
 * script) and the body. Idempotent: applying it twice produces the same
 * document.
 */
export function transformHead(html: string, head: string): string {
  const match = html.match(HEAD_PATTERN)
  if (!match) throw new Error("Expected an HTML document with a <head> element")

  const kept = headLines(match[2])
  const added = head
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const inner = [...kept, ...added].map((line) => `    ${line}`).join("\n")

  return html.replace(HEAD_PATTERN, `${match[1]}\n${inner}\n  ${match[3]}`)
}

/**
 * Produces every HTML artifact for a build from the built `index.html`: the
 * catch-all under its original name and one flat document per indexable route
 * (`/login` → `login.html`). The body is never rendered; only the head differs.
 */
export function buildRouteDocuments(
  indexHtml: string,
  siteUrl: string
): Record<string, string> {
  const documents: Record<string, string> = {
    "index.html": transformHead(indexHtml, buildCatchAllHead(siteUrl)),
  }

  for (const [path, metadata] of Object.entries(routeMetadata) as [
    RoutePath,
    RouteMetadata,
  ][]) {
    if (!metadata.indexable) continue
    documents[`${path.slice(1)}.html`] = transformHead(
      indexHtml,
      buildPublicHead(path, siteUrl)
    )
  }

  return documents
}
