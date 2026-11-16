import { expect, test } from "@playwright/test"

import { pageTitle, routeMetadata } from "../src/routes/route-metadata"
import { login } from "./helpers"

// Raw HTTP only: no browser, no JavaScript. This is the request a link-preview
// crawler makes, and it proves the dev middleware emits the same Page metadata
// the build writes rather than leaving it to the client component.
test("raw HTTP documents carry the public Page metadata without JavaScript", async ({
  request,
}) => {
  for (const path of ["/login", "/register"] as const) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)

    const html = await response.text()
    const origin = new URL(response.url()).origin
    const metadata = routeMetadata[path]
    const title = pageTitle(metadata.title)
    const canonical = `${origin}${path}`

    expect(html).toContain(`<title data-seo="title">${title}</title>`)
    expect(html).toContain(
      `<meta name="description" content="${metadata.description}" data-seo="description" />`
    )
    expect(html).toContain(
      `<link rel="canonical" href="${canonical}" data-seo="canonical" />`
    )
    expect(html).toContain(
      '<meta name="robots" content="index, follow" data-seo="robots" />'
    )
    expect(html).toContain(
      `<meta property="og:title" content="${title}" data-seo="og:title" />`
    )
    expect(html).toMatch(
      /<script type="application\/ld\+json" data-seo="json-ld">[^<]*"@type":"WebApplication"/
    )
    expect(html).toContain(`"url":"${canonical}"`)
  }
})

test("head follows navigation between dashboard pages and a public route", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await expect(page).toHaveURL(/\/dashboard\/tasks/)

  // The dashboard is excluded: catch-all title, noindex, no canonical/og:url.
  await expect(page).toHaveTitle("Dashboard")
  await expect(page.locator('[data-seo="robots"]')).toHaveAttribute(
    "content",
    "noindex"
  )
  await expect(page.locator('[data-seo="canonical"]')).toHaveCount(0)
  await expect(page.locator('[data-seo="og:url"]')).toHaveCount(0)
  await expect(page.locator('[data-seo="json-ld"]')).toHaveCount(0)
  await expect(page.locator('[data-seo="description"]')).toHaveCount(1)

  // Moving between dashboard pages keeps exactly one tag per key and stays
  // excluded.
  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/dashboard\/users/)
  await expect(page).toHaveTitle("Dashboard")
  await expect(page.locator('[data-seo="robots"]')).toHaveAttribute(
    "content",
    "noindex"
  )
  await expect(page.locator('[data-seo="canonical"]')).toHaveCount(0)
  await expect(page.locator('[data-seo="description"]')).toHaveCount(1)

  // Signing out lands on the public sign-in page and restores its metadata,
  // with canonical derived from the browser origin.
  await page.locator('[data-sidebar="footer"]').getByRole("button").click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login/)

  const origin = new URL(page.url()).origin
  await expect(page).toHaveTitle("Sign in | Dashboard")
  await expect(page.locator('[data-seo="robots"]')).toHaveAttribute(
    "content",
    "index, follow"
  )
  await expect(page.locator('[data-seo="canonical"]')).toHaveAttribute(
    "href",
    `${origin}/login`
  )
  await expect(page.locator('[data-seo="og:url"]')).toHaveAttribute(
    "content",
    `${origin}/login`
  )
  await expect(page.locator('[data-seo="description"]')).toHaveCount(1)
  await expect(page.locator('[data-seo="json-ld"]')).toHaveCount(1)
})
