import { describe, expect, it } from "vitest"

import { canonicalUrl, routeMetadata } from "../src/routes/route-metadata"
import {
  SITEMAP_NAMESPACE,
  buildCrawlFiles,
  buildRobotsTxt,
  buildSitemapXml,
  crawlFileForPath,
  escapeXml,
  indexableRoutePaths,
} from "../vite-plugins/seo-crawl"

const SITE_URL = "https://dashboard.example"

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])
}

describe("robots.txt", () => {
  it("pins the exact content for a canonical origin", () => {
    expect(buildRobotsTxt(SITE_URL)).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /dashboard/",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        "",
      ].join("\n")
    )
  })

  it("uses the concrete origin passed by the build", () => {
    expect(buildRobotsTxt(SITE_URL)).toContain(
      `Sitemap: ${SITE_URL}/sitemap.xml`
    )
  })

})

describe("sitemap.xml", () => {
  it("pins the exact content for a canonical origin", () => {
    expect(buildSitemapXml(SITE_URL)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<urlset xmlns="${SITEMAP_NAMESPACE}">`,
        "  <url>",
        `    <loc>${SITE_URL}/login</loc>`,
        "  </url>",
        "  <url>",
        `    <loc>${SITE_URL}/register</loc>`,
        "  </url>",
        "</urlset>",
        "",
      ].join("\n")
    )
  })

  it("lists exactly the two indexable routes as absolute URLs", () => {
    const locs = sitemapLocs(buildSitemapXml(SITE_URL))

    expect(locs).toEqual([`${SITE_URL}/login`, `${SITE_URL}/register`])
  })

  it("uses the same canonical URL strings as the HTML head", () => {
    const locs = sitemapLocs(buildSitemapXml(SITE_URL))

    expect(new Set(locs)).toEqual(
      new Set(indexableRoutePaths().map((path) => canonicalUrl(path, SITE_URL)))
    )
  })

  it("carries no lastmod", () => {
    expect(buildSitemapXml(SITE_URL)).not.toContain("lastmod")
  })

  it("excludes protected routes and the origin root", () => {
    const locs = sitemapLocs(buildSitemapXml(SITE_URL))

    expect(locs.some((loc) => loc.includes("/dashboard/"))).toBe(false)
    expect(locs).not.toContain(SITE_URL)
    expect(locs).not.toContain(`${SITE_URL}/`)
  })
})

describe("indexable routes", () => {
  it("derives the sitemap set from the route table", () => {
    expect(indexableRoutePaths()).toEqual(["/login", "/register"])
    expect(
      Object.entries(routeMetadata)
        .filter(([, metadata]) => metadata.indexable)
        .map(([path]) => path)
        .sort()
    ).toEqual(indexableRoutePaths())
  })
})

describe("XML escaping", () => {
  it("escapes characters that could break the sitemap document", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;"
    )
  })
})

describe("crawl file routing", () => {
  it("builds every crawler file from one origin", () => {
    expect(buildCrawlFiles(SITE_URL)).toEqual({
      "robots.txt": buildRobotsTxt(SITE_URL),
      "sitemap.xml": buildSitemapXml(SITE_URL),
    })
  })

  it("serves robots.txt and sitemap.xml with their content types", () => {
    expect(crawlFileForPath("/robots.txt", SITE_URL)).toEqual({
      body: buildRobotsTxt(SITE_URL),
      contentType: "text/plain; charset=utf-8",
    })
    expect(crawlFileForPath("/sitemap.xml", SITE_URL)).toEqual({
      body: buildSitemapXml(SITE_URL),
      contentType: "application/xml; charset=utf-8",
    })
  })

  it("leaves every other path to the app", () => {
    expect(crawlFileForPath("/login", SITE_URL)).toBeNull()
    expect(crawlFileForPath("/dashboard/tasks", SITE_URL)).toBeNull()
    expect(crawlFileForPath("/robots.txt/", SITE_URL)).toBeNull()
  })
})
