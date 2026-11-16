import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  DEFAULT_SITE_URL,
  expectedRobotsTxt,
  expectedSitemapXml,
  resolveSiteUrl,
  verifyBuiltArtifact,
  verifyCatchAllDocument,
  verifyPublicDocument,
  verifyRobotsTxt,
  verifySitemapXml,
  verifyVercelConfig,
} from "../scripts/seo/verify.mjs"

const SITE_URL = "https://dashboard.example"

function loadFixture(name: string) {
  return readFileSync(new URL(`./fixtures/seo/${name}`, import.meta.url), "utf8")
}

function loadVercel() {
  return JSON.parse(loadFixture("vercel.json")) as {
    rewrites: { source: string; destination: string }[]
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
}

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

describe("public documents", () => {
  it("accepts the compliant fixtures for both public routes", () => {
    expect(verifyPublicDocument(loginHtml, "/login", SITE_URL)).toEqual([])
    expect(verifyPublicDocument(registerHtml, "/register", SITE_URL)).toEqual([])
  })

  it("names a missing required tag", () => {
    const broken = loginHtml.replace(
      /<meta name="description"[^>]*\/>\n/,
      ""
    )

    const problems = verifyPublicDocument(broken, "/login", SITE_URL)

    expect(problems).toContain(
      'login.html: missing <meta name="description">'
    )
  })

  it("names a duplicate tag", () => {
    const duplicate = loginHtml.replace(
      "</head>",
      '<meta property="og:url" content="https://dashboard.example/login" data-seo="og:url" />\n  </head>'
    )

    const problems = verifyPublicDocument(duplicate, "/login", SITE_URL)

    expect(problems).toContain(
      'login.html: duplicate <meta property="og:url"> (found 2)'
    )
  })

  it("fails when a canonical is relative or on the wrong origin", () => {
    const relative = loginHtml.replace(
      'href="https://dashboard.example/login"',
      'href="/login"'
    )

    expect(verifyPublicDocument(relative, "/login", SITE_URL)).toContain(
      'login.html: <link rel="canonical"> href is "/login", expected "https://dashboard.example/login"'
    )
  })

  it("fails when the route copy does not match", () => {
    const wrongTitle = loginHtml.replace(
      "<title data-seo=\"title\">Sign in | Dashboard</title>",
      '<title data-seo="title">Wrong title</title>'
    )

    expect(verifyPublicDocument(wrongTitle, "/login", SITE_URL)).toContain(
      'login.html: <title> is "Wrong title", expected "Sign in | Dashboard"'
    )
  })

  it("fails when og:url and canonical disagree", () => {
    const broken = loginHtml.replace(
      'content="https://dashboard.example/login" data-seo="og:url"',
      'content="https://dashboard.example/register" data-seo="og:url"'
    )

    expect(verifyPublicDocument(broken, "/login", SITE_URL)).toContain(
      'login.html: <meta property="og:url"> is "https://dashboard.example/register", expected "https://dashboard.example/login"'
    )
  })

  it("fails when the JSON-LD payload is not WebApplication", () => {
    const broken = loginHtml.replace(
      '"@type":"WebApplication"',
      '"@type":"Organization"'
    )

    expect(verifyPublicDocument(broken, "/login", SITE_URL)).toContain(
      'login.html: JSON-LD @type is "Organization", expected "WebApplication"'
    )
  })
})

describe("catch-all document", () => {
  it("accepts the compliant fixture", () => {
    expect(verifyCatchAllDocument(indexHtml, SITE_URL)).toEqual([])
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

    expect(verifyCatchAllDocument(withCanonical, SITE_URL)).toContain(
      'index.html: unexpected <link rel="canonical"> on the catch-all'
    )
    expect(verifyCatchAllDocument(withOgUrl, SITE_URL)).toContain(
      'index.html: unexpected <meta property="og:url"> on the catch-all'
    )
    expect(verifyCatchAllDocument(withJsonLd, SITE_URL)).toContain(
      'index.html: unexpected <script type="application/ld+json"> on the catch-all'
    )
  })

  it("requires noindex on the catch-all", () => {
    const indexable = indexHtml.replace(
      'content="noindex" data-seo="robots"',
      'content="index, follow" data-seo="robots"'
    )

    expect(verifyCatchAllDocument(indexable, SITE_URL)).toContain(
      'index.html: <meta name="robots"> is "index, follow", expected "noindex"'
    )
  })
})

describe("robots.txt", () => {
  it("accepts the exact policy", () => {
    expect(verifyRobotsTxt(robotsTxt, SITE_URL)).toEqual([])
    expect(robotsTxt).toBe(expectedRobotsTxt(SITE_URL))
  })

  it("names a missing disallow line", () => {
    const broken = robotsTxt.replace("Disallow: /dashboard/\n", "")

    expect(verifyRobotsTxt(broken, SITE_URL)).toContain(
      'robots.txt: missing line "Disallow: /dashboard/"'
    )
  })

  it("names an unexpected line", () => {
    const broken = `${robotsTxt}Disallow: /login\n`

    expect(verifyRobotsTxt(broken, SITE_URL)).toContain(
      'robots.txt: unexpected line "Disallow: /login"'
    )
  })

  it("fails when the sitemap points at another origin", () => {
    const broken = robotsTxt.replace(
      `${SITE_URL}/sitemap.xml`,
      "https://other.example/sitemap.xml"
    )

    expect(verifyRobotsTxt(broken, SITE_URL).join("\n")).toMatch(
      /Sitemap: https:\/\/dashboard\.example\/sitemap\.xml/
    )
  })
})

describe("sitemap.xml", () => {
  it("accepts exactly the two public URLs", () => {
    expect(verifySitemapXml(sitemapXml, SITE_URL)).toEqual([])
    expect(sitemapXml).toBe(expectedSitemapXml(SITE_URL))
  })

  it("names a missing public URL", () => {
    const broken = sitemapXml.replace(
      "  <url>\n    <loc>https://dashboard.example/register</loc>\n  </url>\n",
      ""
    )

    expect(verifySitemapXml(broken, SITE_URL)).toContain(
      "sitemap.xml: missing <loc> https://dashboard.example/register"
    )
  })

  it("rejects a lastmod", () => {
    const broken = sitemapXml.replace(
      "  </url>",
      "    <lastmod>2026-11-16</lastmod>\n  </url>"
    )

    expect(verifySitemapXml(broken, SITE_URL)).toContain(
      "sitemap.xml: contains a lastmod element; the sitemap must have none"
    )
  })

  it("names a protected route that leaked into the sitemap", () => {
    const broken = sitemapXml.replace(
      "</urlset>",
      "  <url>\n    <loc>https://dashboard.example/dashboard/tasks</loc>\n  </url>\n</urlset>"
    )

    expect(verifySitemapXml(broken, SITE_URL)).toContain(
      "sitemap.xml: unexpected <loc> https://dashboard.example/dashboard/tasks"
    )
  })
})

describe("vercel.json host rules", () => {
  it("accepts the compliant fixture", () => {
    expect(verifyVercelConfig(loadVercel())).toEqual([])
  })

  it("fails when a public rewrite is missing", () => {
    const config = loadVercel()
    config.rewrites = config.rewrites.filter(
      (rule) => rule.source !== "/register"
    )

    expect(verifyVercelConfig(config)).toContain(
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

    expect(verifyVercelConfig(config)).toContain(
      "vercel.json: rewrite /login appears after the catch-all; public rewrites must come first"
    )
  })

  it("fails when the dashboard noindex header is missing", () => {
    const config = loadVercel()
    config.headers = []

    expect(verifyVercelConfig(config)).toContain(
      'vercel.json: missing X-Robots-Tag: noindex header for "/dashboard/:path*"'
    )
  })
})

describe("built artifact", () => {
  it("passes on the compliant fixture directory", () => {
    expect(
      verifyBuiltArtifact({
        distDir: fixtureDist,
        siteUrl: SITE_URL,
        vercelPath: fixtureVercel,
      })
    ).toEqual([])
  })

  it("names a missing artifact file", () => {
    const problems = verifyBuiltArtifact({
      distDir: fileURLToPath(new URL("./fixtures/seo", import.meta.url)),
      siteUrl: SITE_URL,
      vercelPath: fixtureVercel,
    })

    expect(problems).toContain(
      `${fileURLToPath(new URL("./fixtures/seo/login.html", import.meta.url))}: missing or unreadable file`
    )
  })
})

describe("site URL resolution", () => {
  it("defaults to the local preview origin", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL)
  })

  it("strips trailing slashes", () => {
    expect(resolveSiteUrl("https://example.com///")).toBe(
      "https://example.com"
    )
  })
})
