import { expect, test } from "@playwright/test"

import {
  CONTENT_REGION,
  PAGE_FRAME,
  TABLE_FOOTER,
  expectWindowLocked,
  login,
} from "./helpers"

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

    const {
      frameTop,
      frameBottom,
      headerBottom,
      regionBottom,
      regionOverflow,
      regionScrollTop,
    } = await page.evaluate(
      ({ regionSelector, frameSelector }) => {
        const frameElement = document.querySelector(
          frameSelector
        ) as HTMLElement
        const regionElement = document.querySelector(
          regionSelector
        ) as HTMLElement
        const headerElement = document.querySelector(
          '[data-slot="sidebar-inset"] header'
        ) as HTMLElement
        return {
          frameTop: frameElement.getBoundingClientRect().top,
          frameBottom: frameElement.getBoundingClientRect().bottom,
          headerBottom: headerElement.getBoundingClientRect().bottom,
          regionBottom: regionElement.getBoundingClientRect().bottom,
          regionOverflow:
            regionElement.scrollHeight - regionElement.clientHeight,
          regionScrollTop: regionElement.scrollTop,
        }
      },
      { regionSelector: CONTENT_REGION, frameSelector: PAGE_FRAME }
    )

    // The frame fills exactly the area below the fixed header, so the title,
    // filters, grid, and pagination fit without the content region scrolling
    // at the default viewport.
    expect(frameTop).toBeGreaterThanOrEqual(headerBottom - 1)
    expect(Math.abs(frameBottom - regionBottom)).toBeLessThanOrEqual(1)
    expect(regionOverflow).toBeLessThanOrEqual(1)
    expect(regionScrollTop).toBe(0)
    await expectWindowLocked(page)
  }
})

test("short-viewport list screens grow the frame and scroll the content region", async ({
  page,
}) => {
  // Shorter than the frame's minimum content, so the frame must grow past the
  // region's client height and the region must own the fallback scroll.
  await page.setViewportSize({ width: 1280, height: 420 })
  await login(page, "admin@example.com", "adminpass")

  for (const path of ["/roles", "/tasks", "/users"]) {
    await page.goto(path)
    await expect(page.getByRole("table")).toBeVisible()

    const geometry = await page.evaluate(
      ({ regionSelector, frameSelector }) => {
        const region = document.querySelector(regionSelector) as HTMLElement
        const frame = document.querySelector(frameSelector) as HTMLElement
        return {
          regionClientHeight: region.clientHeight,
          regionScrollHeight: region.scrollHeight,
          regionScrollTop: region.scrollTop,
          frameHeight: frame.getBoundingClientRect().height,
        }
      },
      { regionSelector: CONTENT_REGION, frameSelector: PAGE_FRAME }
    )

    // The content region owns the overflow, and the frame grew (it is taller
    // than the region's client height) rather than merely overflowing.
    expect(geometry.regionScrollHeight).toBeGreaterThan(
      geometry.regionClientHeight
    )
    expect(geometry.frameHeight).toBeGreaterThan(geometry.regionClientHeight)
    expect(geometry.regionScrollTop).toBe(0)
    await expectWindowLocked(page)

    // Nothing is clipped: the region can scroll, and at the end the pinned
    // pagination and the bottom of the frame are both reachable.
    const footer = page.locator(TABLE_FOOTER)
    await page.locator(CONTENT_REGION).evaluate((element) => {
      element.scrollTo({ top: element.scrollHeight })
    })
    await expect
      .poll(() =>
        page.locator(CONTENT_REGION).evaluate((element) => element.scrollTop)
      )
      .toBeGreaterThan(0)
    await expect(footer).toBeInViewport()

    const scrolled = await page.evaluate(
      ({ regionSelector, frameSelector }) => {
        const region = document.querySelector(regionSelector) as HTMLElement
        const frame = document.querySelector(frameSelector) as HTMLElement
        return {
          regionBottom: region.getBoundingClientRect().bottom,
          frameBottom: frame.getBoundingClientRect().bottom,
        }
      },
      { regionSelector: CONTENT_REGION, frameSelector: PAGE_FRAME }
    )
    expect(scrolled.frameBottom).toBeLessThanOrEqual(scrolled.regionBottom + 1)
    await expectWindowLocked(page)
  }
})
