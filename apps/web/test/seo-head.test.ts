import { describe, expect, it } from "vitest"

import {
  DEFAULT_SITE_URL,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  pageTitle,
  routeMetadata,
} from "../src/routes/route-metadata"
import {
  buildCatchAllHead,
  buildPublicHead,
  buildRouteDocuments,
  escapeAttribute,
  escapeHtml,
  publicRoutePath,
  transformHead,
} from "../vite-plugins/seo-head"

const SITE_URL = "https://dashboard.example"

function jsonLd(head: string) {
  const match = head.match(
    /<script type="application\/ld\+json" data-seo="json-ld">([\s\S]*?)<\/script>/
  )
  return match ? JSON.parse(match[1]) : undefined
}

const builtIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard</title>
    <meta name="description" content="stale description" />
    <link rel="canonical" href="https://old.example/login" />
    <meta property="og:url" content="https://old.example/login" />
    <script type="application/ld+json">{"stale":true}</script>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

describe("public head", () => {
  const login = routeMetadata["/login"]
  const head = buildPublicHead("/login", SITE_URL)

  it("emits the templated title and description", () => {
    expect(head).toContain(
      `<title data-seo="title">${pageTitle(login.title)}</title>`
    )
    expect(head).toContain(
      `<meta name="description" content="${login.description}" data-seo="description" />`
    )
  })

  it("emits an absolute canonical and an indexable robots directive", () => {
    expect(head).toContain(
      `<link rel="canonical" href="${SITE_URL}/login" data-seo="canonical" />`
    )
    expect(head).toContain(
      '<meta name="robots" content="index, follow" data-seo="robots" />'
    )
  })

  it("emits the social tags including the preview image", () => {
    const imageUrl = `${SITE_URL}${OG_IMAGE_PATH}`

    expect(head).toContain(
      `<meta property="og:title" content="${pageTitle(login.title)}" data-seo="og:title" />`
    )
    expect(head).toContain(
      `<meta property="og:description" content="${login.description}" data-seo="og:description" />`
    )
    expect(head).toContain(
      `<meta property="og:url" content="${SITE_URL}/login" data-seo="og:url" />`
    )
    expect(head).toContain(
      '<meta property="og:type" content="website" data-seo="og:type" />'
    )
    expect(head).toContain(
      `<meta property="og:site_name" content="${SITE_NAME}" data-seo="og:site_name" />`
    )
    expect(head).toContain(
      `<meta property="og:image" content="${imageUrl}" data-seo="og:image" />`
    )
    expect(head).toContain(
      `<meta property="og:image:alt" content="${OG_IMAGE_ALT}" data-seo="og:image:alt" />`
    )
    expect(head).toContain(
      `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" data-seo="og:image:width" />`
    )
    expect(head).toContain(
      `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" data-seo="og:image:height" />`
    )
    expect(head).toContain(
      '<meta name="twitter:card" content="summary_large_image" data-seo="twitter:card" />'
    )
    expect(head).toContain(
      `<meta name="twitter:title" content="${pageTitle(login.title)}" data-seo="twitter:title" />`
    )
    expect(head).toContain(
      `<meta name="twitter:description" content="${login.description}" data-seo="twitter:description" />`
    )
    expect(head).toContain(
      `<meta name="twitter:image" content="${imageUrl}" data-seo="twitter:image" />`
    )
  })

  it("emits valid WebApplication JSON-LD pointing at the canonical URL", () => {
    expect(jsonLd(head)).toEqual({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      description: login.description,
      url: `${SITE_URL}/login`,
    })
  })

  it("derives the register metadata independently", () => {
    const register = routeMetadata["/register"]
    const registerHead = buildPublicHead("/register", SITE_URL)

    expect(registerHead).toContain(`${SITE_URL}/register`)
    expect(registerHead).toContain(pageTitle(register.title))
    expect(jsonLd(registerHead)?.url).toBe(`${SITE_URL}/register`)
  })
})

describe("catch-all head", () => {
  const head = buildCatchAllHead(SITE_URL)

  it("uses the site title and description", () => {
    expect(head).toContain(`<title data-seo="title">${SITE_NAME}</title>`)
    expect(head).toContain(
      `<meta name="description" content="${SITE_DESCRIPTION}" data-seo="description" />`
    )
  })

  it("carries the social tags minus og:url", () => {
    const imageUrl = `${SITE_URL}${OG_IMAGE_PATH}`

    expect(head).toContain(
      `<meta property="og:title" content="${SITE_NAME}" data-seo="og:title" />`
    )
    expect(head).toContain(
      `<meta property="og:description" content="${SITE_DESCRIPTION}" data-seo="og:description" />`
    )
    expect(head).toContain('data-seo="twitter:card"')
    expect(head).toContain(
      `<meta property="og:image" content="${imageUrl}" data-seo="og:image" />`
    )
    expect(head).toContain(
      `<meta property="og:image:alt" content="${OG_IMAGE_ALT}" data-seo="og:image:alt" />`
    )
    expect(head).toContain(
      `<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" data-seo="og:image:width" />`
    )
    expect(head).toContain(
      `<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" data-seo="og:image:height" />`
    )
    expect(head).toContain(
      `<meta name="twitter:image" content="${imageUrl}" data-seo="twitter:image" />`
    )
    expect(head).not.toContain("og:url")
  })

  it("is noindex and carries no canonical or JSON-LD", () => {
    expect(head).toContain(
      '<meta name="robots" content="noindex" data-seo="robots" />'
    )
    expect(head).not.toContain("canonical")
    expect(head).not.toContain("application/ld+json")
  })

  it("falls back to the preview origin for the image when SITE_URL is unset", () => {
    expect(buildCatchAllHead()).toContain(
      `content="${DEFAULT_SITE_URL}${OG_IMAGE_PATH}"`
    )
  })
})

describe("transformHead", () => {
  it("replaces stale SEO tags and preserves the Vite script tags", () => {
    const html = transformHead(
      builtIndexHtml,
      buildPublicHead("/login", SITE_URL)
    )

    expect(html).not.toContain("stale description")
    expect(html).not.toContain('{"stale":true}')
    expect(html).not.toContain("https://old.example/login")
    expect(html.match(/<title/g)).toHaveLength(1)
    expect(html).toContain(
      '<script type="module" crossorigin src="/assets/index-abc.js"></script>'
    )
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain(`href="${SITE_URL}/login"`)
  })

  it("is idempotent, so a rebuilt document keeps one tag per key", () => {
    const head = buildPublicHead("/login", SITE_URL)
    const once = transformHead(builtIndexHtml, head)
    const twice = transformHead(once, head)

    expect(twice).toBe(once)
  })
})

describe("buildRouteDocuments", () => {
  const documents = buildRouteDocuments(builtIndexHtml, SITE_URL)

  it("emits one flat HTML file per public route plus the catch-all", () => {
    expect(Object.keys(documents).sort()).toEqual([
      "index.html",
      "login.html",
      "register.html",
    ])
  })

  it("keeps the SPA root and script in every emitted document", () => {
    for (const html of Object.values(documents)) {
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain('src="/assets/index-abc.js"')
    }
  })

  it("gives the catch-all noindex and no canonical", () => {
    expect(documents["index.html"]).toContain(
      '<meta name="robots" content="noindex" data-seo="robots" />'
    )
    expect(documents["index.html"]).not.toContain('rel="canonical"')
  })

  it("gives each public document its own canonical", () => {
    expect(documents["login.html"]).toContain(`href="${SITE_URL}/login"`)
    expect(documents["register.html"]).toContain(`href="${SITE_URL}/register"`)
  })

  it("references the absolute preview image on both public documents", () => {
    const imageUrl = `${SITE_URL}${OG_IMAGE_PATH}`

    for (const name of ["login.html", "register.html"]) {
      const html = documents[name]
      expect(html).toContain(
        `<meta property="og:image" content="${imageUrl}" data-seo="og:image" />`
      )
      expect(html).toContain(
        `<meta property="og:image:alt" content="${OG_IMAGE_ALT}" data-seo="og:image:alt" />`
      )
      expect(html).toContain(
        `<meta property="og:image:width" content="1200" data-seo="og:image:width" />`
      )
      expect(html).toContain(
        `<meta property="og:image:height" content="630" data-seo="og:image:height" />`
      )
      expect(html).toContain(
        `<meta name="twitter:image" content="${imageUrl}" data-seo="twitter:image" />`
      )
      expect(html).toContain(
        '<meta name="twitter:card" content="summary_large_image" data-seo="twitter:card" />'
      )
    }
  })

  it("carries the preview image on the catch-all without og:url or canonical", () => {
    const html = documents["index.html"]

    expect(html).toContain(
      `<meta property="og:image" content="${SITE_URL}${OG_IMAGE_PATH}" data-seo="og:image" />`
    )
    expect(html).toContain(
      `<meta name="twitter:image" content="${SITE_URL}${OG_IMAGE_PATH}" data-seo="twitter:image" />`
    )
    expect(html).not.toContain("og:url")
    expect(html).not.toContain('rel="canonical"')
  })

  it("never loads the preview image in any emitted document", () => {
    for (const html of Object.values(documents)) {
      // The image URL appears only in the two metadata tags.
      expect(html.match(/\/og-image\.png/g)).toHaveLength(2)
      expect(html).not.toMatch(/<img\b/i)
      expect(html).not.toMatch(/<link\b[^>]*rel="preload"[^>]*as="image"/i)
      expect(html).not.toMatch(/fetch\([^)]*og-image/i)
    }
  })
})

describe("publicRoutePath", () => {
  it("resolves exactly the indexable route paths", () => {
    expect(publicRoutePath("/login")).toBe("/login")
    expect(publicRoutePath("/register")).toBe("/register")
  })

  it("returns null for protected, unknown, and non-canonical paths", () => {
    expect(publicRoutePath("/dashboard/tasks")).toBeNull()
    expect(publicRoutePath("/unknown")).toBeNull()
    expect(publicRoutePath("/login/")).toBeNull()
  })
})

describe("escaping", () => {
  it("escapes text content", () => {
    expect(escapeHtml(`<Dashboard & "friends">`)).toBe(
      "&lt;Dashboard &amp; &quot;friends&quot;&gt;"
    )
  })

  it("escapes attribute values", () => {
    expect(escapeAttribute(`" onload="alert(1)`)).toBe(
      "&quot; onload=&quot;alert(1)"
    )
  })
})
