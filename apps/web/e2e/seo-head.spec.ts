import { expect, test } from "@playwright/test"

import { login } from "./helpers"

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
