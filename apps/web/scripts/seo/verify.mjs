#!/usr/bin/env node
// Build-output check for the SEO metadata contract on the production artifact.
//
// Input: the `dist/` directory written by `vite build` (never the dev server)
// plus `apps/web/vercel.json`. Output: PASS/FAIL with every missing tag, file,
// or host rule named. Exits 1 on any breach so CI can block the pull request.
//
// This is the only check that proves the head exists for a non-JS crawler:
// Lighthouse executes JavaScript and cannot distinguish a templated head from
// a client-written one.
//
// The pure helpers below are covered by `test/seo-verify.test.ts`; the
// command-line entry point only handles files, formatting, and exit codes.

import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))

export const DEFAULT_SITE_URL = "http://localhost:4173"

export const SITE_NAME = "Dashboard"
export const SITE_DESCRIPTION =
  "A reusable dashboard for managing tasks, users, and settings."
export const OG_IMAGE_PATH = "/og-image.png"
export const OG_IMAGE_WIDTH = "1200"
export const OG_IMAGE_HEIGHT = "630"
export const OG_IMAGE_ALT =
  "Dashboard: manage your tasks, users, and settings in one place."
export const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"

/**
 * The public-route contract, declared here because this script is plain
 * JavaScript and cannot import the TypeScript route table. It is deliberately
 * small: the exact copy that must be in the built HTML plus the file the host
 * rewrite points at. Keep it in step with `src/routes/route-metadata.ts` when a
 * public route is added; `/login` and `/register` are the only indexable
 * routes (spec §3, §5.2).
 */
export const PUBLIC_ROUTES = [
  {
    path: "/login",
    file: "login.html",
    title: "Sign in | Dashboard",
    description:
      "Sign in to the dashboard to manage your tasks, users, and settings.",
  },
  {
    path: "/register",
    file: "register.html",
    title: "Create an account | Dashboard",
    description:
      "Create an account to start managing tasks, users, and settings.",
  },
]

export function resolveSiteUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) return DEFAULT_SITE_URL
  return trimmed.replace(/\/+$/, "")
}

function canonicalUrl(path, siteUrl) {
  return `${resolveSiteUrl(siteUrl)}${path}`
}

function imageUrl(siteUrl) {
  return `${resolveSiteUrl(siteUrl)}${OG_IMAGE_PATH}`
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" }

function decodeHtml(value) {
  return value.replace(/&(#39|amp|lt|gt|quot|apos);/g, (_, name) => {
    return ENTITIES[name] ?? `&${name};`
  })
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
 * Every head tag with an SEO meaning, keyed the way the spec names it:
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

/**
 * Asserts the §5.2 head of one public document: every tag present exactly
 * once, with absolute URLs derived from the configured origin.
 */
export function verifyPublicDocument(html, routePath, siteUrl) {
  const route = PUBLIC_ROUTES.find((candidate) => candidate.path === routePath)
  if (!route) throw new Error(`Unknown public route: ${routePath}`)

  const file = route.file
  const head = extractHead(html)
  if (head === null) return [`${file}: missing <head> element`]

  const grouped = groupByKey(collectSeoEntries(head))
  const problems = []
  checkDuplicates(file, grouped, problems)

  const canonical = canonicalUrl(route.path, siteUrl)
  const image = imageUrl(siteUrl)

  const title = requireOne(file, grouped, "title", problems)
  expectValue(file, "title", title, route.title, problems)

  const description = requireOne(file, grouped, "description", problems)
  expectValue(file, "description", description, route.description, problems)

  expectHref(
    file,
    "canonical",
    requireOne(file, grouped, "canonical", problems),
    canonical,
    problems
  )

  expectValue(
    file,
    "robots",
    requireOne(file, grouped, "robots", problems),
    "index, follow",
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
  expectValue(
    file,
    "og:url",
    requireOne(file, grouped, "og:url", problems),
    canonical,
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
    SITE_NAME,
    problems
  )
  expectValue(
    file,
    "og:image",
    requireOne(file, grouped, "og:image", problems),
    image,
    problems
  )
  expectValue(
    file,
    "og:image:alt",
    requireOne(file, grouped, "og:image:alt", problems),
    OG_IMAGE_ALT,
    problems
  )
  expectValue(
    file,
    "og:image:width",
    requireOne(file, grouped, "og:image:width", problems),
    OG_IMAGE_WIDTH,
    problems
  )
  expectValue(
    file,
    "og:image:height",
    requireOne(file, grouped, "og:image:height", problems),
    OG_IMAGE_HEIGHT,
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
  expectValue(
    file,
    "twitter:image",
    requireOne(file, grouped, "twitter:image", problems),
    image,
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
      if (payload.name !== SITE_NAME) {
        problems.push(
          `${file}: JSON-LD name is ${JSON.stringify(payload.name)}, expected ${JSON.stringify(SITE_NAME)}`
        )
      }
      if (payload.description !== route.description) {
        problems.push(
          `${file}: JSON-LD description is ${JSON.stringify(payload.description)}, expected ${JSON.stringify(route.description)}`
        )
      }
      if (payload.url !== canonical) {
        problems.push(
          `${file}: JSON-LD url is ${JSON.stringify(payload.url)}, expected ${JSON.stringify(canonical)}`
        )
      }
    }
  }

  return problems
}

/**
 * Asserts the §5.3 catch-all head: site defaults plus `noindex`, and no
 * canonical, `og:url`, or structured data that would be asserted for every
 * path the document serves.
 */
export function verifyCatchAllDocument(html, siteUrl) {
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
    SITE_NAME,
    problems
  )
  expectValue(
    file,
    "description",
    requireOne(file, grouped, "description", problems),
    SITE_DESCRIPTION,
    problems
  )
  expectValue(
    file,
    "robots",
    requireOne(file, grouped, "robots", problems),
    "noindex",
    problems
  )

  expectValue(
    file,
    "og:title",
    requireOne(file, grouped, "og:title", problems),
    SITE_NAME,
    problems
  )
  expectValue(
    file,
    "og:description",
    requireOne(file, grouped, "og:description", problems),
    SITE_DESCRIPTION,
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
    SITE_NAME,
    problems
  )
  expectValue(
    file,
    "og:image",
    requireOne(file, grouped, "og:image", problems),
    imageUrl(siteUrl),
    problems
  )
  expectValue(
    file,
    "og:image:alt",
    requireOne(file, grouped, "og:image:alt", problems),
    OG_IMAGE_ALT,
    problems
  )
  expectValue(
    file,
    "og:image:width",
    requireOne(file, grouped, "og:image:width", problems),
    OG_IMAGE_WIDTH,
    problems
  )
  expectValue(
    file,
    "og:image:height",
    requireOne(file, grouped, "og:image:height", problems),
    OG_IMAGE_HEIGHT,
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
    SITE_NAME,
    problems
  )
  expectValue(
    file,
    "twitter:description",
    requireOne(file, grouped, "twitter:description", problems),
    SITE_DESCRIPTION,
    problems
  )
  expectValue(
    file,
    "twitter:image",
    requireOne(file, grouped, "twitter:image", problems),
    imageUrl(siteUrl),
    problems
  )

  if (grouped.has("canonical")) {
    problems.push(`${file}: unexpected ${describeKey("canonical")} on the catch-all`)
  }
  if (grouped.has("og:url")) {
    problems.push(`${file}: unexpected ${describeKey("og:url")} on the catch-all`)
  }
  if (grouped.has("json-ld")) {
    problems.push(`${file}: unexpected ${describeKey("json-ld")} on the catch-all`)
  }

  return problems
}

export function expectedRobotsTxt(siteUrl) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard/",
    `Sitemap: ${resolveSiteUrl(siteUrl)}/sitemap.xml`,
    "",
  ].join("\n")
}

/** Asserts §5.4 byte-for-byte, naming any missing or unexpected line. */
export function verifyRobotsTxt(content, siteUrl) {
  const expected = expectedRobotsTxt(siteUrl)
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
      `robots.txt: content does not match the expected policy for ${resolveSiteUrl(siteUrl)} (check line order and the trailing newline)`
    )
  }

  return problems
}

export function expectedSitemapXml(siteUrl) {
  const urls = PUBLIC_ROUTES.map((route) => {
    const loc = canonicalUrl(route.path, siteUrl)
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
 * Asserts exactly the two public URLs, each byte-identical to the page
 * canonical, and no `lastmod` (there is no real modification time).
 */
export function verifySitemapXml(content, siteUrl) {
  const expected = expectedSitemapXml(siteUrl)
  const expectedLocs = PUBLIC_ROUTES.map((route) =>
    canonicalUrl(route.path, siteUrl)
  )
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
      `sitemap.xml: content does not match the expected document for ${resolveSiteUrl(siteUrl)}`
    )
  }

  return problems
}

/**
 * Asserts the host rules in `vercel.json`: public rewrites before the
 * catch-all, and the dashboard response-level `noindex` header. `vite preview`
 * does not apply these, so inspecting the config is the only local proof.
 */
export function verifyVercelConfig(config) {
  const problems = []
  const rewrites = Array.isArray(config?.rewrites) ? config.rewrites : []
  const headers = Array.isArray(config?.headers) ? config.headers : []

  const catchAllIndex = rewrites.findIndex(
    (rule) => rule?.source === "/(.*)" && rule?.destination === "/index.html"
  )
  if (catchAllIndex === -1) {
    problems.push(
      'vercel.json: missing catch-all rewrite "/(.*)" -> "/index.html"'
    )
  }

  for (const route of PUBLIC_ROUTES) {
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

  const dashboard = headers.find(
    (rule) => rule?.source === "/dashboard/:path*"
  )
  const hasNoindex = Array.isArray(dashboard?.headers)
    ? dashboard.headers.some(
        (header) =>
          String(header?.key).toLowerCase() === "x-robots-tag" &&
          String(header?.value).toLowerCase() === "noindex"
      )
    : false
  if (!hasNoindex) {
    problems.push(
      'vercel.json: missing X-Robots-Tag: noindex header for "/dashboard/:path*"'
    )
  }

  return problems
}

function readText(file, problems) {
  try {
    return readFileSync(file, "utf8")
  } catch {
    problems.push(`${file}: missing or unreadable file`)
    return null
  }
}

/**
 * Reads the built artifact and returns every contract breach. The caller
 * decides how to report them; an empty array means the artifact is compliant.
 */
export function verifyBuiltArtifact({ distDir, siteUrl, vercelPath }) {
  const problems = []
  const read = (name) => readText(join(distDir, name), problems)

  for (const route of PUBLIC_ROUTES) {
    const html = read(route.file)
    if (html !== null) {
      problems.push(...verifyPublicDocument(html, route.path, siteUrl))
    }
  }

  const indexHtml = read("index.html")
  if (indexHtml !== null) {
    problems.push(...verifyCatchAllDocument(indexHtml, siteUrl))
  }

  const robots = read("robots.txt")
  if (robots !== null) problems.push(...verifyRobotsTxt(robots, siteUrl))

  const sitemap = read("sitemap.xml")
  if (sitemap !== null) problems.push(...verifySitemapXml(sitemap, siteUrl))

  const vercelJson = readText(vercelPath, problems)
  if (vercelJson !== null) {
    try {
      problems.push(...verifyVercelConfig(JSON.parse(vercelJson)))
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
    siteUrl: resolveSiteUrl(process.env.SITE_URL),
    vercelPath: resolve(APP_DIR, "vercel.json"),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--dist") options.distDir = resolve(argv[++index])
    else if (arg === "--site-url") options.siteUrl = resolveSiteUrl(argv[++index])
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
    `SEO verification passed for ${PUBLIC_ROUTES.map((route) => route.path).join(", ")}, ` +
      `robots.txt, sitemap.xml, and vercel.json at ${options.siteUrl}.\n`
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
