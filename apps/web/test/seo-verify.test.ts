import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import {
  SEO_MANIFEST_FILE,
  expectedRobotsTxt,
  expectedSitemapXml,
  validateManifest,
  verifyBuiltArtifact,
  verifyCatchAllDocument,
  verifyPublicDocument,
  verifyRobotsTxt,
  verifySitemapXml,
  verifyVercelConfig,
} from "../scripts/seo/verify.mjs"

function loadFixture(name: string) {
  return readFileSync(new URL(`./fixtures/seo/${name}`, import.meta.url), "utf8")
}

function loadVercel() {
  return JSON.parse(loadFixture("vercel.json")) as {
    rewrites: { source: string; destination: string }[]
    redirects: { source: string; destination: string; permanent?: boolean }[]
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
}

type ManifestRoute = {
  path: string
  file: string
  title: string
  description: string
  canonical: string
  robots: string
}

type Manifest = {
  siteUrl: string
  site: { name: string; description: string; titleTemplate: string }
  ogImage: {
    path: string
    url: string
    alt: string
    width: number
    height: number
  }
  catchAll: { title: string; description: string; robots: string }
  routes: ManifestRoute[]
}

const manifest = JSON.parse(loadFixture("built/seo-manifest.json")) as Manifest
const loginRoute = manifest.routes.find((route) => route.path === "/login")!
const registerRoute = manifest.routes.find(
  (route) => route.path === "/register"
)!

const loginHtml = loadFixture("built/login.html")
const registerHtml = loadFixture("built/register.html")
const indexHtml = loadFixture("built/index.html")
const robotsTxt = loadFixture("built/robots.txt")
const sitemapXml = loadFixture("built/sitemap.xml")
const fixtureDist = fileURLToPath(
  new URL("./fixtures/seo/built", import.meta.url)
)
const fixtureVercel = fileURLToPath(
  new URL("./fixtures/seo/vercel.json", import.meta.url)
)

const temporaryDirectories: string[] = []

function makeTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "seo-verify-"))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("manifest", () => {
  it("accepts the fixture manifest", () => {
    expect(validateManifest(manifest)).toEqual([])
  })

  it("names a missing siteUrl", () => {
    const broken = { ...manifest, siteUrl: undefined }

    expect(validateManifest(broken)).toContain(
      `${SEO_MANIFEST_FILE}: siteUrl is missing or not absolute`
    )
  })

  it("names a missing route list", () => {
    const broken = { ...manifest, routes: [] }

    expect(validateManifest(broken)).toContain(
      `${SEO_MANIFEST_FILE}: routes is missing or empty`
    )
  })
})

describe("public documents", () => {
  it("accepts the compliant fixtures for both public routes", () => {
    expect(verifyPublicDocument(loginHtml, loginRoute, manifest)).toEqual([])
    expect(verifyPublicDocument(registerHtml, registerRoute, manifest)).toEqual(
      []
    )
  })

  it("names a missing required tag", () => {
    const broken = loginHtml.replace(
      /<meta name="description"[^>]*\/>\n/,
      ""
    )

    const problems = verifyPublicDocument(broken, loginRoute, manifest)

    expect(problems).toContain(
      'login.html: missing <meta name="description">'
    )
  })

  it("names a duplicate tag", () => {
    const duplicate = loginHtml.replace(
      "</head>",
      '<meta property="og:url" content="https://dashboard.example/login" data-seo="og:url" />\n  </head>'
    )

    const problems = verifyPublicDocument(duplicate, loginRoute, manifest)

    expect(problems).toContain(
      'login.html: duplicate <meta property="og:url"> (found 2)'
    )
  })

  it("fails when a canonical is relative", () => {
    const relative = loginHtml.replace(
      'href="https://dashboard.example/login"',
      'href="/login"'
    )

    expect(verifyPublicDocument(relative, loginRoute, manifest)).toContain(
      'login.html: <link rel="canonical"> href is not an absolute URL ("/login")'
    )
  })

  it("fails when the route copy does not match the manifest", () => {
    const wrongTitle = loginHtml.replace(
      "<title data-seo=\"title\">Sign in | Dashboard</title>",
      '<title data-seo="title">Wrong title</title>'
    )

    expect(verifyPublicDocument(wrongTitle, loginRoute, manifest)).toContain(
      'login.html: <title> is "Wrong title", expected "Sign in | Dashboard"'
    )
  })

  it("checks copy against the manifest rather than a second hard-coded table", () => {
    const renamedManifest: Manifest = {
      ...manifest,
      routes: manifest.routes.map((route) =>
        route.path === "/login" ? { ...route, title: "Welcome back" } : route
      ),
    }
    const renamedHtml = loginHtml.replaceAll("Sign in | Dashboard", "Welcome back")

    expect(
      verifyPublicDocument(renamedHtml, renamedManifest.routes[0], renamedManifest)
    ).toEqual([])
  })

  it("fails when og:url and canonical disagree", () => {
    const broken = loginHtml.replace(
      'content="https://dashboard.example/login" data-seo="og:url"',
      'content="https://dashboard.example/register" data-seo="og:url"'
    )

    expect(verifyPublicDocument(broken, loginRoute, manifest)).toContain(
      'login.html: <meta property="og:url"> is "https://dashboard.example/register", expected "https://dashboard.example/login"'
    )
  })

  it("fails when the JSON-LD payload is not WebApplication", () => {
    const broken = loginHtml.replace(
      '"@type":"WebApplication"',
      '"@type":"Organization"'
    )

    expect(verifyPublicDocument(broken, loginRoute, manifest)).toContain(
      'login.html: JSON-LD @type is "Organization", expected "WebApplication"'
    )
  })
})

describe("catch-all document", () => {
  it("accepts the compliant fixture", () => {
    expect(verifyCatchAllDocument(indexHtml, manifest)).toEqual([])
  })

  it("rejects a canonical, og:url, or JSON-LD on the catch-all", () => {
    const withCanonical = indexHtml.replace(
      "</head>",
      '<link rel="canonical" href="https://dashboard.example/" data-seo="canonical" />\n  </head>'
    )
    const withOgUrl = indexHtml.replace(
      "</head>",
      '<meta property="og:url" content="https://dashboard.example/" data-seo="og:url" />\n  </head>'
    )
    const withJsonLd = indexHtml.replace(
      "</head>",
      '<script type="application/ld+json" data-seo="json-ld">{}</script>\n  </head>'
    )

    expect(verifyCatchAllDocument(withCanonical, manifest)).toContain(
      'index.html: unexpected <link rel="canonical"> on the catch-all'
    )
    expect(verifyCatchAllDocument(withOgUrl, manifest)).toContain(
      'index.html: unexpected <meta property="og:url"> on the catch-all'
    )
    expect(verifyCatchAllDocument(withJsonLd, manifest)).toContain(
      'index.html: unexpected <script type="application/ld+json"> on the catch-all'
    )
  })

  it("requires noindex on the catch-all", () => {
    const indexable = indexHtml.replace(
      'content="noindex" data-seo="robots"',
      'content="index, follow" data-seo="robots"'
    )

    expect(verifyCatchAllDocument(indexable, manifest)).toContain(
      'index.html: <meta name="robots"> is "index, follow", expected "noindex"'
    )
  })
})

describe("robots.txt", () => {
  it("accepts the exact policy", () => {
    expect(verifyRobotsTxt(robotsTxt, manifest)).toEqual([])
    expect(robotsTxt).toBe(expectedRobotsTxt(manifest))
  })

  it("names a missing disallow line", () => {
    const broken = robotsTxt.replace("Disallow: /dashboard/\n", "")

    expect(verifyRobotsTxt(broken, manifest)).toContain(
      'robots.txt: missing line "Disallow: /dashboard/"'
    )
  })

  it("names an unexpected line", () => {
    const broken = `${robotsTxt}Disallow: /login\n`

    expect(verifyRobotsTxt(broken, manifest)).toContain(
      'robots.txt: unexpected line "Disallow: /login"'
    )
  })

  it("fails when the sitemap points at another origin", () => {
    const broken = robotsTxt.replace(
      `${manifest.siteUrl}/sitemap.xml`,
      "https://other.example/sitemap.xml"
    )

    expect(verifyRobotsTxt(broken, manifest).join("\n")).toMatch(
      /Sitemap: https:\/\/dashboard\.example\/sitemap\.xml/
    )
  })
})

describe("sitemap.xml", () => {
  it("accepts exactly the manifest routes", () => {
    expect(verifySitemapXml(sitemapXml, manifest)).toEqual([])
    expect(sitemapXml).toBe(expectedSitemapXml(manifest))
  })

  it("names a missing public URL", () => {
    const broken = sitemapXml.replace(
      "  <url>\n    <loc>https://dashboard.example/register</loc>\n  </url>\n",
      ""
    )

    expect(verifySitemapXml(broken, manifest)).toContain(
      "sitemap.xml: missing <loc> https://dashboard.example/register"
    )
  })

  it("rejects a lastmod", () => {
    const broken = sitemapXml.replace(
      "  </url>",
      "    <lastmod>2026-11-16</lastmod>\n  </url>"
    )

    expect(verifySitemapXml(broken, manifest)).toContain(
      "sitemap.xml: contains a lastmod element; the sitemap must have none"
    )
  })

  it("names a protected route that leaked into the sitemap", () => {
    const broken = sitemapXml.replace(
      "</urlset>",
      "  <url>\n    <loc>https://dashboard.example/dashboard/tasks</loc>\n  </url>\n</urlset>"
    )

    expect(verifySitemapXml(broken, manifest)).toContain(
      "sitemap.xml: unexpected <loc> https://dashboard.example/dashboard/tasks"
    )
  })
})

describe("vercel.json host rules", () => {
  it("accepts the compliant fixture", () => {
    expect(verifyVercelConfig(loadVercel(), manifest)).toEqual([])
  })

  it("fails when the root redirect is missing", () => {
    const config = loadVercel()
    config.redirects = []

    expect(verifyVercelConfig(config, manifest)).toContain(
      'vercel.json: missing permanent redirect "/" -> "/login"'
    )
  })

  it("fails when a public rewrite is missing", () => {
    const config = loadVercel()
    config.rewrites = config.rewrites.filter(
      (rule) => rule.source !== "/register"
    )

    expect(verifyVercelConfig(config, manifest)).toContain(
      "vercel.json: missing rewrite /register -> /register.html"
    )
  })

  it("fails when a public rewrite comes after the catch-all", () => {
    const config = loadVercel()
    const catchAll = config.rewrites.find(
      (rule) => rule.source === "/(.*)"
    )!
    config.rewrites = [
      ...config.rewrites.filter(
        (rule) => rule !== catchAll && rule.source !== "/login"
      ),
      catchAll,
      { source: "/login", destination: "/login.html" },
    ]

    expect(verifyVercelConfig(config, manifest)).toContain(
      "vercel.json: rewrite /login appears after the catch-all; public rewrites must come first"
    )
  })

  it("fails when the dashboard noindex header is missing", () => {
    const config = loadVercel()
    config.headers = []

    expect(verifyVercelConfig(config, manifest)).toContain(
      'vercel.json: missing X-Robots-Tag: noindex header for "/dashboard/:path*"'
    )
  })
})

describe("built artifact", () => {
  it("passes on the compliant fixture directory", () => {
    expect(
      verifyBuiltArtifact({
        distDir: fixtureDist,
        vercelPath: fixtureVercel,
      })
    ).toEqual([])
  })

  it("names a missing artifact file", () => {
    const distDir = makeTemporaryDirectory()
    cpSync(fixtureDist, distDir, { recursive: true })
    rmSync(join(distDir, "login.html"))

    const problems = verifyBuiltArtifact({
      distDir,
      vercelPath: fixtureVercel,
    })

    expect(problems).toContain(
      `${join(distDir, "login.html")}: missing or unreadable file`
    )
  })

  it("names a missing manifest", () => {
    const problems = verifyBuiltArtifact({
      distDir: fileURLToPath(new URL("./fixtures/seo", import.meta.url)),
      vercelPath: fixtureVercel,
    })

    expect(problems).toContain(
      `${fileURLToPath(new URL("./fixtures/seo/seo-manifest.json", import.meta.url))}: missing or unreadable file`
    )
  })
})
