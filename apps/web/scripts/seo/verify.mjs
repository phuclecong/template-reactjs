#!/usr/bin/env node
// Build-output check for the Page metadata contract on the production artifact.
//
// Input: the `dist/` directory written by `vite build` (never the dev server)
// plus `apps/web/vercel.json`. Output: PASS/FAIL with every missing tag, file,
// or host rule named. Exits 1 on any breach so CI can block the pull request.
//
// This is the only check that proves the head exists for a non-JS crawler:
// Lighthouse executes JavaScript and cannot distinguish a templated head from
// a client-written one.
//
// Route copy and preview-image fields are not duplicated here. The build
// writes `dist/seo-manifest.json` from the typed route table, and this script
// asserts the real artifacts against that manifest. Editing
// `src/routes/route-metadata.ts` therefore needs no change here.
//
// The pure helpers below are covered by `test/seo-verify.test.ts`; the
// command-line entry point only handles files, formatting, and exit codes.

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))

export const SEO_MANIFEST_FILE = "seo-manifest.json"
export const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"
export const DASHBOARD_PREFIX = "/dashboard/"
const DASHBOARD_HEADER_SOURCE = "/dashboard/:path*"

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" }

function decodeHtml(value) {
  return value.replace(/&(#39|amp|lt|gt|quot|apos);/g, (_, name) => {
    return ENTITIES[name] ?? `&${name};`
  })
}

const XML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character])
}

const ATTRIBUTE_PATTERN =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g

function parseAttributes(tag) {
  const attributes = {}
  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    attributes[match[1].toLowerCase()] = decodeHtml(
      match[2] ?? match[3] ?? match[4] ?? ""
    )
  }
  return attributes
}

function extractHead(html) {
  const match = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  return match ? match[1] : null
}

/**
 * Every head tag with a metadata meaning, keyed the way the spec names it:
 * `title`, `description`, `canonical`, `robots`, `og:*`, `twitter:*`, and
 * `json-ld`. Non-metadata tags (charset, viewport, stylesheet, modulepreload)
 * are ignored.
 */
function collectSeoEntries(head) {
  const entries = []

  // Titles carry text, so scan them separately from the self-closing tags.
  for (const match of head.matchAll(
    /<title\b[^>]*>([\s\S]*?)<\/title>/gi
  )) {
    entries.push({
      key: "title",
      kind: "title",
      attributes: parseAttributes(match[0]),
      text: decodeHtml(match[1].trim()),
    })
  }

  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0])
    const key = attributes.property ?? attributes.name
    if (!key) continue
    entries.push({ key, kind: "meta", attributes, text: "" })
  }

  for (const match of head.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0])
    if ((attributes.rel ?? "").toLowerCase() !== "canonical") continue
    entries.push({ key: "canonical", kind: "link", attributes, text: "" })
  }

  for (const match of head.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )) {
    entries.push({
      key: "json-ld",
      kind: "script",
      attributes: parseAttributes(match[0]),
      text: match[1].trim(),
    })
  }

  return entries
}

function groupByKey(entries) {
  const grouped = new Map()
  for (const entry of entries) {
    const list = grouped.get(entry.key) ?? []
    list.push(entry)
    grouped.set(entry.key, list)
  }
  return grouped
}

function describeKey(key) {
  if (key === "title") return "<title>"
  if (key === "canonical") return '<link rel="canonical">'
  if (key === "json-ld") return '<script type="application/ld+json">'
  if (key.startsWith("og:")) return `<meta property="${key}">`
  return `<meta name="${key}">`
}

function checkDuplicates(file, grouped, problems) {
  for (const [key, entries] of grouped) {
    if (entries.length > 1) {
      problems.push(
        `${file}: duplicate ${describeKey(key)} (found ${entries.length})`
      )
    }
  }
}

function requireOne(file, grouped, key, problems) {
  const entries = grouped.get(key) ?? []
  if (entries.length === 0) {
    problems.push(`${file}: missing ${describeKey(key)}`)
    return null
  }
  return entries[0]
}

function expectValue(file, key, entry, expected, problems) {
  if (!entry) return
  const actual =
    key === "title" || key === "json-ld"
      ? entry.text
      : entry.attributes.content
  if (actual !== expected) {
    problems.push(
      `${file}: ${describeKey(key)} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    )
  }
}

function expectHref(file, key, entry, expected, problems) {
  if (!entry) return
  if (entry.attributes.href !== expected) {
    problems.push(
      `${file}: ${describeKey(key)} href is ${JSON.stringify(entry.attributes.href)}, expected ${JSON.stringify(expected)}`
    )
  }
}

function isAbsoluteUrl(value) {
  return typeof value === "string" && /^https?:\/\/[^/]/.test(value)
}

/**
 * Absolute URLs are part of the contract: a relative canonical or preview image
 * is valid HTML but useless to a crawler. This names the tag before the value
 * comparison so the first failure is the actionable one.
 */
function expectAbsoluteContent(file, key, entry, problems) {
  if (!entry) return
  const actual = entry.attributes.content
  if (!isAbsoluteUrl(actual)) {
    problems.push(
      `${file}: ${describeKey(key)} is not an absolute URL (${JSON.stringify(actual)})`
    )
  }
}

function expectAbsoluteHref(file, key, entry, problems) {
  if (!entry) return
  const actual = entry.attributes.href
  if (!isAbsoluteUrl(actual)) {
    problems.push(
      `${file}: ${describeKey(key)} href is not an absolute URL (${JSON.stringify(actual)})`
    )
  }
}

/**
 * Checks the manifest shape without assuming any route copy: the checker must
 * work for whatever the route table currently declares.
 */
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return [`${SEO_MANIFEST_FILE}: not a JSON object`]
  }

  const problems = []
  if (!isAbsoluteUrl(manifest.siteUrl)) {
    problems.push(`${SEO_MANIFEST_FILE}: siteUrl is missing or not absolute`)
  }
  for (const field of ["name", "description"]) {
    if (typeof manifest.site?.[field] !== "string") {
      problems.push(`${SEO_MANIFEST_FILE}: site.${field} is missing`)
    }
  }
  if (typeof manifest.site?.titleTemplate !== "string") {
    problems.push(`${SEO_MANIFEST_FILE}: site.titleTemplate is missing`)
  }
  for (const field of ["path", "alt"]) {
    if (typeof manifest.ogImage?.[field] !== "string") {
      problems.push(`${SEO_MANIFEST_FILE}: ogImage.${field} is missing`)
    }
  }
  if (!isAbsoluteUrl(manifest.ogImage?.url)) {
    problems.push(
      `${SEO_MANIFEST_FILE}: ogImage.url is missing or not absolute`
    )
  }
  for (const field of ["width", "height"]) {
    if (typeof manifest.ogImage?.[field] !== "number") {
      problems.push(`${SEO_MANIFEST_FILE}: ogImage.${field} is missing`)
    }
  }
  if (
    typeof manifest.catchAll?.title !== "string" ||
    typeof manifest.catchAll?.description !== "string" ||
    typeof manifest.catchAll?.robots !== "string"
  ) {
    problems.push(`${SEO_MANIFEST_FILE}: catchAll metadata is incomplete`)
  }
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) {
    problems.push(`${SEO_MANIFEST_FILE}: routes is missing or empty`)
    return problems
  }

  for (const [index, route] of manifest.routes.entries()) {
    const name = `${SEO_MANIFEST_FILE}: routes[${index}]`
    for (const field of ["path", "file", "title", "description", "robots"]) {
      if (typeof route?.[field] !== "string") {
        problems.push(`${name}.${field} is missing`)
      }
    }
    if (!isAbsoluteUrl(route?.canonical)) {
      problems.push(`${name}.canonical is missing or not absolute`)
    }
    if (typeof route?.file === "string" && !/^[^/]+\.html$/.test(route.file)) {
      problems.push(`${name}.file is not a flat HTML file name`)
    }
  }

  return problems
}

/**
 * Asserts the public document head for one manifest route: every tag present
 * exactly once, absolute, and matching the manifest value.
 */
export function verifyPublicDocument(html, route, manifest) {
  const file = route.file
  const head = extractHead(html)
  if (head === null) return [`${file}: missing <head> element`]

  const grouped = groupByKey(collectSeoEntries(head))
  const problems = []
  checkDuplicates(file, grouped, problems)

  const title = requireOne(file, grouped, "title", problems)
  expectValue(file, "title", title, route.title, problems)

  const description = requireOne(file, grouped, "description", problems)
  expectValue(file, "description", description, route.description, problems)

  const canonical = requireOne(file, grouped, "canonical", problems)
  expectAbsoluteHref(file, "canonical", canonical, problems)
  expectHref(file, "canonical", canonical, route.canonical, problems)

  expectValue(
    file,
    "robots",
    requireOne(file, grouped, "robots", problems),
    route.robots,
    problems
  )

  expectValue(
    file,
    "og:title",
    requireOne(file, grouped, "og:title", problems),
    route.title,
    problems
  )
  expectValue(
    file,
    "og:description",
    requireOne(file, grouped, "og:description", problems),
    route.description,
    problems
  )
  const ogUrl = requireOne(file, grouped, "og:url", problems)
  expectAbsoluteContent(file, "og:url", ogUrl, problems)
  expectValue(file, "og:url", ogUrl, route.canonical, problems)

  expectValue(
    file,
    "og:type",
    requireOne(file, grouped, "og:type", problems),
    "website",
    problems
  )
  expectValue(
    file,
    "og:site_name",
    requireOne(file, grouped, "og:site_name", problems),
    manifest.site.name,
    problems
  )

  const ogImage = requireOne(file, grouped, "og:image", problems)
  expectAbsoluteContent(file, "og:image", ogImage, problems)
  expectValue(file, "og:image", ogImage, manifest.ogImage.url, problems)

  expectValue(
    file,
    "og:image:alt",
    requireOne(file, grouped, "og:image:alt", problems),
    manifest.ogImage.alt,
    problems
  )
  expectValue(
    file,
    "og:image:width",
    requireOne(file, grouped, "og:image:width", problems),
    String(manifest.ogImage.width),
    problems
  )
  expectValue(
    file,
    "og:image:height",
    requireOne(file, grouped, "og:image:height", problems),
    String(manifest.ogImage.height),
    problems
  )
  expectValue(
    file,
    "twitter:card",
    requireOne(file, grouped, "twitter:card", problems),
    "summary_large_image",
    problems
  )
  expectValue(
    file,
    "twitter:title",
    requireOne(file, grouped, "twitter:title", problems),
    route.title,
    problems
  )
  expectValue(
    file,
    "twitter:description",
    requireOne(file, grouped, "twitter:description", problems),
    route.description,
    problems
  )
  const twitterImage = requireOne(file, grouped, "twitter:image", problems)
  expectAbsoluteContent(file, "twitter:image", twitterImage, problems)
  expectValue(
    file,
    "twitter:image",
    twitterImage,
    manifest.ogImage.url,
    problems
  )

  const jsonLd = requireOne(file, grouped, "json-ld", problems)
  if (jsonLd) {
    let payload
    try {
      payload = JSON.parse(jsonLd.text)
    } catch (error) {
      problems.push(
        `${file}: JSON-LD is not valid JSON (${error instanceof Error ? error.message : String(error)})`
      )
    }
    if (payload) {
      if (payload["@type"] !== "WebApplication") {
        problems.push(
          `${file}: JSON-LD @type is ${JSON.stringify(payload["@type"])}, expected "WebApplication"`
        )
      }
      if (payload.name !== manifest.site.name) {
        problems.push(
          `${file}: JSON-LD name is ${JSON.stringify(payload.name)}, expected ${JSON.stringify(manifest.site.name)}`
        )
      }
      if (payload.description !== route.description) {
        problems.push(
          `${file}: JSON-LD description is ${JSON.stringify(payload.description)}, expected ${JSON.stringify(route.description)}`
        )
      }
      if (payload.url !== route.canonical) {
        problems.push(
          `${file}: JSON-LD url is ${JSON.stringify(payload.url)}, expected ${JSON.stringify(route.canonical)}`
        )
      }
    }
  }

  return problems
}

/**
 * Asserts the catch-all head: site defaults plus `noindex`, and no canonical,
 * `og:url`, or structured data that would be asserted for every path the
 * document serves.
 */
export function verifyCatchAllDocument(html, manifest) {
  const file = "index.html"
  const head = extractHead(html)
  if (head === null) return [`${file}: missing <head> element`]

  const grouped = groupByKey(collectSeoEntries(head))
  const problems = []
  checkDuplicates(file, grouped, problems)

  expectValue(
    file,
    "title",
    requireOne(file, grouped, "title", problems),
    manifest.catchAll.title,
    problems
  )
  expectValue(
    file,
    "description",
    requireOne(file, grouped, "description", problems),
    manifest.catchAll.description,
    problems
  )
  expectValue(
    file,
    "robots",
    requireOne(file, grouped, "robots", problems),
    manifest.catchAll.robots,
    problems
  )

  expectValue(
    file,
    "og:title",
    requireOne(file, grouped, "og:title", problems),
    manifest.catchAll.title,
    problems
  )
  expectValue(
    file,
    "og:description",
    requireOne(file, grouped, "og:description", problems),
    manifest.catchAll.description,
    problems
  )
  expectValue(
    file,
    "og:type",
    requireOne(file, grouped, "og:type", problems),
    "website",
    problems
  )
  expectValue(
    file,
    "og:site_name",
    requireOne(file, grouped, "og:site_name", problems),
    manifest.site.name,
    problems
  )
  const ogImage = requireOne(file, grouped, "og:image", problems)
  expectAbsoluteContent(file, "og:image", ogImage, problems)
  expectValue(file, "og:image", ogImage, manifest.ogImage.url, problems)

  expectValue(
    file,
    "og:image:alt",
    requireOne(file, grouped, "og:image:alt", problems),
    manifest.ogImage.alt,
    problems
  )
  expectValue(
    file,
    "og:image:width",
    requireOne(file, grouped, "og:image:width", problems),
    String(manifest.ogImage.width),
    problems
  )
  expectValue(
    file,
    "og:image:height",
    requireOne(file, grouped, "og:image:height", problems),
    String(manifest.ogImage.height),
    problems
  )
  expectValue(
    file,
    "twitter:card",
    requireOne(file, grouped, "twitter:card", problems),
    "summary_large_image",
    problems
  )
  expectValue(
    file,
    "twitter:title",
    requireOne(file, grouped, "twitter:title", problems),
    manifest.catchAll.title,
    problems
  )
  expectValue(
    file,
    "twitter:description",
    requireOne(file, grouped, "twitter:description", problems),
    manifest.catchAll.description,
    problems
  )
  const twitterImage = requireOne(file, grouped, "twitter:image", problems)
  expectAbsoluteContent(file, "twitter:image", twitterImage, problems)
  expectValue(
    file,
    "twitter:image",
    twitterImage,
    manifest.ogImage.url,
    problems
  )

  if (grouped.has("canonical")) {
    problems.push(
      `${file}: unexpected ${describeKey("canonical")} on the catch-all`
    )
  }
  if (grouped.has("og:url")) {
    problems.push(`${file}: unexpected ${describeKey("og:url")} on the catch-all`)
  }
  if (grouped.has("json-ld")) {
    problems.push(
      `${file}: unexpected ${describeKey("json-ld")} on the catch-all`
    )
  }

  return problems
}

export function expectedRobotsTxt(manifest) {
  return [
    "User-agent: *",
    "Allow: /",
    `Disallow: ${DASHBOARD_PREFIX}`,
    `Sitemap: ${manifest.siteUrl}/sitemap.xml`,
    "",
  ].join("\n")
}

/** Asserts the exact crawler policy, naming any missing or unexpected line. */
export function verifyRobotsTxt(content, manifest) {
  const expected = expectedRobotsTxt(manifest)
  const problems = []
  const expectedLines = expected.split("\n").filter(Boolean)
  const actualLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of expectedLines) {
    if (!actualLines.includes(line)) {
      problems.push(`robots.txt: missing line ${JSON.stringify(line)}`)
    }
  }
  for (const line of actualLines) {
    if (!expectedLines.includes(line)) {
      problems.push(`robots.txt: unexpected line ${JSON.stringify(line)}`)
    }
  }
  if (problems.length === 0 && content !== expected) {
    problems.push(
      `robots.txt: content does not match the expected policy for ${manifest.siteUrl} (check line order and the trailing newline)`
    )
  }

  return problems
}

export function expectedSitemapXml(manifest) {
  const urls = manifest.routes.map((route) => {
    const loc = escapeXml(route.canonical)
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

/**
 * Asserts exactly the manifest routes, each byte-identical to the page
 * canonical, and no `lastmod` (there is no real modification time).
 */
export function verifySitemapXml(content, manifest) {
  const expected = expectedSitemapXml(manifest)
  const expectedLocs = manifest.routes.map((route) => route.canonical)
  const locs = [...content.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) =>
    decodeHtml(match[1].trim())
  )
  const problems = []

  if (content.includes("lastmod")) {
    problems.push(
      "sitemap.xml: contains a lastmod element; the sitemap must have none"
    )
  }

  for (const loc of expectedLocs) {
    const count = locs.filter((candidate) => candidate === loc).length
    if (count === 0) problems.push(`sitemap.xml: missing <loc> ${loc}`)
    else if (count > 1) {
      problems.push(`sitemap.xml: duplicate <loc> ${loc} (found ${count})`)
    }
  }
  for (const loc of locs) {
    if (!expectedLocs.includes(loc)) {
      problems.push(`sitemap.xml: unexpected <loc> ${loc}`)
    }
  }
  if (problems.length === 0 && content !== expected) {
    problems.push(
      `sitemap.xml: content does not match the expected document for ${manifest.siteUrl}`
    )
  }

  return problems
}

/**
 * Asserts the host rules in `vercel.json`: the root redirect to the indexable
 * entry point, public rewrites before the catch-all, and the dashboard
 * response-level `noindex` header. `vite preview` does not apply these, so
 * inspecting the config is the only local proof.
 */
export function verifyVercelConfig(config, manifest) {
  const problems = []
  const rewrites = Array.isArray(config?.rewrites) ? config.rewrites : []
  const headers = Array.isArray(config?.headers) ? config.headers : []
  const redirects = Array.isArray(config?.redirects) ? config.redirects : []

  if (!hasRootRedirect(redirects)) {
    problems.push('vercel.json: missing permanent redirect "/" -> "/login"')
  }

  const catchAllIndex = rewrites.findIndex(
    (rule) => rule?.source === "/(.*)" && rule?.destination === "/index.html"
  )
  if (catchAllIndex === -1) {
    problems.push(
      'vercel.json: missing catch-all rewrite "/(.*)" -> "/index.html"'
    )
  }

  for (const route of manifest.routes) {
    const index = rewrites.findIndex(
      (rule) =>
        rule?.source === route.path && rule?.destination === `/${route.file}`
    )
    if (index === -1) {
      problems.push(
        `vercel.json: missing rewrite ${route.path} -> /${route.file}`
      )
    } else if (catchAllIndex !== -1 && index > catchAllIndex) {
      problems.push(
        `vercel.json: rewrite ${route.path} appears after the catch-all; public rewrites must come first`
      )
    }
  }

  if (!hasDashboardNoindex(headers)) {
    problems.push(
      `vercel.json: missing X-Robots-Tag: noindex header for "${DASHBOARD_HEADER_SOURCE}"`
    )
  }

  return problems
}

function hasRootRedirect(redirects) {
  return redirects.some(
    (rule) =>
      rule?.source === "/" &&
      rule?.destination === "/login" &&
      (rule?.permanent === true || rule?.statusCode === 301)
  )
}

function hasDashboardNoindex(headers) {
  const dashboard = headers.find(
    (rule) => rule?.source === DASHBOARD_HEADER_SOURCE
  )
  return Array.isArray(dashboard?.headers)
    ? dashboard.headers.some(
        (header) =>
          String(header?.key).toLowerCase() === "x-robots-tag" &&
          String(header?.value).toLowerCase() === "noindex"
      )
    : false
}

function readText(file, problems) {
  try {
    return readFileSync(file, "utf8")
  } catch {
    problems.push(`${file}: missing or unreadable file`)
    return null
  }
}

function readManifest(distDir, problems) {
  const file = join(distDir, SEO_MANIFEST_FILE)
  const text = readText(file, problems)
  if (text === null) return null

  let manifest
  try {
    manifest = JSON.parse(text)
  } catch (error) {
    problems.push(
      `${file}: not valid JSON (${error instanceof Error ? error.message : String(error)})`
    )
    return null
  }

  const manifestProblems = validateManifest(manifest)
  problems.push(...manifestProblems)
  return manifestProblems.length === 0 ? manifest : null
}

/**
 * Reads the built artifact and returns every contract breach. The caller
 * decides how to report them; an empty array means the artifact is compliant.
 */
export function verifyBuiltArtifact({ distDir, vercelPath }) {
  const problems = []
  const read = (name) => readText(join(distDir, name), problems)

  const manifest = readManifest(distDir, problems)

  if (manifest !== null) {
    for (const route of manifest.routes) {
      const html = read(route.file)
      if (html !== null) {
        problems.push(...verifyPublicDocument(html, route, manifest))
      }
    }

    const indexHtml = read("index.html")
    if (indexHtml !== null) {
      problems.push(...verifyCatchAllDocument(indexHtml, manifest))
    }

    const robots = read("robots.txt")
    if (robots !== null) problems.push(...verifyRobotsTxt(robots, manifest))

    const sitemap = read("sitemap.xml")
    if (sitemap !== null) problems.push(...verifySitemapXml(sitemap, manifest))
  }

  const vercelJson = readText(vercelPath, problems)
  if (vercelJson !== null) {
    try {
      const config = JSON.parse(vercelJson)
      if (manifest !== null) {
        problems.push(...verifyVercelConfig(config, manifest))
      } else if (!hasDashboardNoindex(Array.isArray(config?.headers) ? config.headers : [])) {
        problems.push(
          `vercel.json: missing X-Robots-Tag: noindex header for "${DASHBOARD_HEADER_SOURCE}"`
        )
      }
    } catch (error) {
      problems.push(
        `vercel.json: not valid JSON (${error instanceof Error ? error.message : String(error)})`
      )
    }
  }

  return problems
}

function parseArgs(argv) {
  const options = {
    distDir: resolve(APP_DIR, "dist"),
    vercelPath: resolve(APP_DIR, "vercel.json"),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--dist") options.distDir = resolve(argv[++index])
    else if (arg === "--vercel") options.vercelPath = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const problems = verifyBuiltArtifact(options)

  if (problems.length > 0) {
    process.stderr.write(
      `SEO verification failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n`
    )
    for (const problem of problems) {
      process.stderr.write(`  - ${problem}\n`)
    }
    return 1
  }

  process.stdout.write(
    `SEO verification passed for the build artifacts at ${options.distDir} ` +
      `(${SEO_MANIFEST_FILE}, public documents, index.html, robots.txt, sitemap.xml, and vercel.json).\n`
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  }
}
