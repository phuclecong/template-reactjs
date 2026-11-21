import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

/** The page-level scroll region below the fixed header. */
const CONTENT_REGION = '[data-slot="sidebar-inset"]'

/** The shared frame every list screen renders through. */
const PAGE_FRAME = '[data-slot="table-page-layout"]'

/** Asserts the browser window itself cannot scroll. */
async function expectWindowLocked(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return root.scrollHeight - root.clientHeight
  })
  expect(overflow).toBeLessThanOrEqual(1)

  await page.evaluate(() => window.scrollTo(0, 10_000))
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
}

test("the browser window does not scroll on any authenticated route", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  const routes = [
    { path: "/dashboard", ready: "heading" as const, name: "Dashboard" },
    { path: "/tasks", ready: "table" as const },
    { path: "/users", ready: "table" as const },
    { path: "/roles", ready: "table" as const },
    { path: "/settings", ready: "heading" as const, name: "Settings" },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    if (route.ready === "table") {
      await expect(page.getByRole("table")).toBeVisible()
    } else {
      await expect(
        page.getByRole("heading", { name: route.name })
      ).toBeVisible()
    }

    await expect(page.locator(CONTENT_REGION)).toBeVisible()
    await expectWindowLocked(page)
  }
})

test("short-viewport Settings content scrolls inside the content region", async ({
  page,
}) => {
  // Taller than the 48px header but shorter than the Settings form, so the
  // content region must take over scrolling instead of clipping the form.
  await page.setViewportSize({ width: 1280, height: 420 })
  await login(page, "admin@example.com", "adminpass")
  await page.goto("/settings")
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()

  const region = page.locator(CONTENT_REGION)
  const submit = page.getByRole("button", { name: "Update password" })
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" })

  // The region, not the window, owns the overflow.
  await expect
    .poll(() =>
      region.evaluate((element) => element.scrollHeight - element.clientHeight)
    )
    .toBeGreaterThan(0)
  await expect(submit).not.toBeInViewport()
  await expectWindowLocked(page)

  // Scrolling the region reveals the form and keeps the header in place.
  await region.evaluate((element) => element.scrollTo({ top: 10_000 }))
  await expect
    .poll(() => region.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)
  await expect(submit).toBeInViewport()
  await expect(breadcrumb).toBeInViewport()
  await expectWindowLocked(page)
})

test("list screens render through the shared viewport-fitted page frame", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  for (const path of ["/roles", "/tasks", "/users"]) {
    await page.goto(path)
    await expect(page.getByRole("table")).toBeVisible()

    const frame = page.locator(PAGE_FRAME)
    await expect(frame).toBeVisible()

    const { frameTop, frameBottom, headerBottom, regionBottom } =
      await page.evaluate(() => {
        const frameElement = document.querySelector(
          '[data-slot="table-page-layout"]'
        ) as HTMLElement
        const regionElement = document.querySelector(
          '[data-slot="sidebar-inset"]'
        ) as HTMLElement
        const headerElement = document.querySelector(
          '[data-slot="sidebar-inset"] header'
        ) as HTMLElement
        return {
          frameTop: frameElement.getBoundingClientRect().top,
          frameBottom: frameElement.getBoundingClientRect().bottom,
          headerBottom: headerElement.getBoundingClientRect().bottom,
          regionBottom: regionElement.getBoundingClientRect().bottom,
        }
      })

    // The frame fills exactly the area below the fixed header, so the title,
    // filters, grid, and pagination fit without the content region scrolling
    // at the default viewport.
    expect(frameTop).toBeGreaterThanOrEqual(headerBottom - 1)
    expect(Math.abs(frameBottom - regionBottom)).toBeLessThanOrEqual(1)
  }
})
