import { expect, test, type Locator, type Page } from "@playwright/test"

import {
  CONTENT_REGION,
  PAGE_FRAME,
  TABLE_FOOTER,
  TABLE_SCROLL,
  expectWindowLocked,
  login,
} from "./helpers"

type Screen = {
  path: string
  /** A non-table element that proves the page (not the previous route) loaded. */
  ready: (page: Page) => Locator
  /** The filter surface that must stay visible with the table. */
  filters: (page: Page) => Locator
  /** A column header that must stay visible with the rows scrolling. */
  header: string
}

const SCREENS: Screen[] = [
  {
    path: "/roles",
    ready: (page) => page.getByRole("heading", { name: "Roles" }),
    filters: (page) => page.getByRole("group", { name: "Filters" }),
    header: "Title",
  },
  {
    path: "/tasks",
    ready: (page) => page.getByRole("heading", { name: "Tasks" }),
    filters: (page) => page.getByRole("group", { name: "Task filters" }),
    header: "Title",
  },
  {
    path: "/users",
    // Narrow viewports collapse the filter controls, so the toggle is the
    // non-table surface that proves the screen mounted at every width.
    ready: (page) => page.getByRole("button", { name: "Filters", exact: true }),
    filters: (page) => page.getByRole("textbox", { name: "Search users" }),
    header: "Name",
  },
]

type FrameGeometry = {
  regionClientHeight: number
  regionScrollHeight: number
  regionScrollTop: number
  frameTop: number
  frameBottom: number
}

async function frameGeometry(page: Page): Promise<FrameGeometry> {
  return page.evaluate(
    ({ regionSelector, frameSelector }) => {
      const region = document.querySelector(regionSelector) as HTMLElement
      const frame = document.querySelector(frameSelector) as HTMLElement
      return {
        regionClientHeight: region.clientHeight,
        regionScrollHeight: region.scrollHeight,
        regionScrollTop: region.scrollTop,
        frameTop: frame.getBoundingClientRect().top,
        frameBottom: frame.getBoundingClientRect().bottom,
      }
    },
    { regionSelector: CONTENT_REGION, frameSelector: PAGE_FRAME }
  )
}

type ScrollGeometry = {
  scrollTopEdge: number
  scrollClientHeight: number
  scrollScrollHeight: number
  scrollScrollTop: number
}

/** The body scroll metrics, or null while the shell shows a non-grid state. */
async function scrollGeometry(page: Page): Promise<ScrollGeometry | null> {
  return page.evaluate((selector) => {
    const scroll = document.querySelector(selector) as HTMLElement | null
    if (!scroll) return null
    return {
      scrollTopEdge: scroll.getBoundingClientRect().top,
      scrollClientHeight: scroll.clientHeight,
      scrollScrollHeight: scroll.scrollHeight,
      scrollScrollTop: scroll.scrollTop,
    }
  }, TABLE_SCROLL)
}

async function expectScrollTop(page: Page, expected: number) {
  await expect
    .poll(async () => (await scrollGeometry(page))?.scrollScrollTop)
    .toBe(expected)
}

/** The frame fits the region below the fixed header, without page scrolling. */
async function expectFrameFitted(page: Page) {
  await expect
    .poll(async () => {
      const current = await frameGeometry(page)
      return (
        current.regionScrollHeight - current.regionClientHeight <= 1 &&
        current.regionScrollTop === 0
      )
    })
    .toBe(true)
}

async function scrollBody(page: Page, top: number) {
  // Dynamic row measurement can adjust the body's offset for a frame or two
  // as new rows mount. Re-apply the requested offset until it holds for a few
  // frames, so the test measures the settled position rather than a transient.
  await page.locator(TABLE_SCROLL).evaluate(async (element, value) => {
    const nextFrame = () =>
      new Promise<number>((resolve) => requestAnimationFrame(resolve))
    let stableFrames = 0
    for (let frame = 0; frame < 30 && stableFrames < 3; frame += 1) {
      ;(element as HTMLElement).scrollTop = value
      await nextFrame()
      stableFrames =
        Math.abs((element as HTMLElement).scrollTop - value) < 1
          ? stableFrames + 1
          : 0
    }
  }, top)
}

test("list screens fit the frame and only the table body scrolls", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  for (const screen of SCREENS) {
    await page.goto(screen.path)
    await expect(screen.ready(page)).toBeVisible()
    await expect(page.getByRole("table")).toBeVisible()
    await expect(page.locator(PAGE_FRAME)).toBeVisible()

    // The window and the content region do not scroll at the default size.
    await expectWindowLocked(page)
    await expectFrameFitted(page)

    // Title, filters, header, and pagination are visible together.
    await expect(screen.filters(page)).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: screen.header })
    ).toBeVisible()
    await expect(page.locator(TABLE_FOOTER)).toBeVisible()
    await expect(page.locator(TABLE_FOOTER)).toBeInViewport()

    // The body is the bounded scroll surface; the scroll element has no tab
    // stop of its own.
    await expect(page.locator(TABLE_SCROLL)).not.toHaveAttribute("tabindex")
  }
})

test("scrolling the body keeps the header and pagination in place", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  for (const path of ["/roles", "/tasks"]) {
    await page.goto(path)
    await expect(page.getByRole("table")).toBeVisible()
    await expectFrameFitted(page)

    const initial = await scrollGeometry(page)
    expect(initial).not.toBeNull()
    expect(initial!.scrollScrollHeight).toBeGreaterThan(
      initial!.scrollClientHeight
    )

    const header = page.getByRole("columnheader", { name: "Title" })
    const headerTop = (await header.boundingBox())?.y ?? 0

    await scrollBody(page, 320)
    await expectScrollTop(page, 320)

    const after = await scrollGeometry(page)
    expect(after).not.toBeNull()
    expect(after!.scrollScrollTop).toBeGreaterThan(0)

    // The header row stays pinned at the top of the body.
    const stickyTop = (await header.boundingBox())?.y ?? 0
    expect(Math.abs(stickyTop - headerTop)).toBeLessThanOrEqual(1)
    expect(Math.abs(stickyTop - after!.scrollTopEdge)).toBeLessThanOrEqual(1)

    // The header is opaque and carries its own inset bottom rule, because
    // `border-collapse: collapse` can drop a sticky cell's border.
    const headerStyle = await header.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        boxShadow: style.boxShadow,
        position: style.position,
      }
    })
    expect(headerStyle.position).toBe("sticky")
    // Opaque: the computed colour carries no alpha channel, so rows cannot
    // show through the pinned header.
    expect(headerStyle.background).not.toContain("/")
    expect(headerStyle.background).not.toBe("transparent")
    expect(headerStyle.background).not.toBe("rgba(0, 0, 0, 0)")
    expect(headerStyle.boxShadow).toContain("inset")

    // Pagination is still visible and the window still does not scroll.
    await expect(page.locator(TABLE_FOOTER)).toBeInViewport()
    await expectWindowLocked(page)
  }
})

test("page, page-size, filter, and sort changes return the body to the top", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await page.goto("/roles")
  await expect(page.getByRole("table")).toBeVisible()
  await expectFrameFitted(page)

  async function expectResetAfter(change: () => Promise<void>) {
    await scrollBody(page, 360)
    await expectScrollTop(page, 360)
    await change()
    await expectScrollTop(page, 0)
  }

  await expectResetAfter(async () => {
    await page.getByLabel("Page 2", { exact: true }).click()
  })

  await expectResetAfter(async () => {
    await page.getByLabel("Rows per page").click()
    await page.getByRole("option", { name: "100", exact: true }).click()
  })
  await expect(page.getByText("60 roles")).toBeVisible()

  await expectResetAfter(async () => {
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Demo Role")
  })
  await expect(page.getByText("58 roles")).toBeVisible()

  await expectResetAfter(async () => {
    await page.getByRole("button", { name: "Updated", exact: true }).click()
  })

  // Selection and the bulk bar do not change the list state, so acting on
  // rows leaves the body where the user left it. Click through the DOM so
  // Playwright's actionability scrolling cannot move the body first.
  await scrollBody(page, 260)
  await expectScrollTop(page, 260)

  const selectAll = page.getByRole("checkbox", {
    name: "Select all roles on this page",
  })
  await selectAll.evaluate((element) => (element as HTMLElement).click())
  await expect(page.getByRole("region", { name: "Bulk actions" })).toBeVisible()
  await expectScrollTop(page, 260)

  await selectAll.evaluate((element) => (element as HTMLElement).click())
  await expect(page.getByRole("region", { name: "Bulk actions" })).toHaveCount(
    0
  )
  await expectScrollTop(page, 260)
})

test("horizontal overflow stays inside the table at a narrow width", async ({
  page,
}) => {
  // 700px is wide enough for the auto table layout to fit; 480px is where all
  // three tables are genuinely wider than their content region.
  await page.setViewportSize({ width: 480, height: 800 })
  await login(page, "admin@example.com", "adminpass")

  for (const screen of SCREENS) {
    await page.goto(screen.path)
    await expect(screen.ready(page)).toBeVisible()
    await expect(page.getByRole("table")).toBeVisible()

    // The table really is wider than its frame at this viewport, so the
    // overflow is not absent - it is owned by the table.
    const widths = await page.evaluate(
      ({ scrollSelector }) => {
        const scroll = document.querySelector(scrollSelector) as HTMLElement
        const root = document.scrollingElement ?? document.documentElement
        return {
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          documentScrollWidth: root.scrollWidth,
          documentClientWidth: root.clientWidth,
        }
      },
      { scrollSelector: TABLE_SCROLL }
    )
    expect(widths.scrollWidth).toBeGreaterThan(widths.clientWidth)
    // The document itself does not gain horizontal overflow.
    expect(widths.documentScrollWidth).toBeLessThanOrEqual(
      widths.documentClientWidth + 1
    )
    await expectWindowLocked(page)

    // Scrolling the table body horizontally moves the table, not the page.
    await page.locator(TABLE_SCROLL).evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    await expect
      .poll(() =>
        page.locator(TABLE_SCROLL).evaluate((element) => element.scrollLeft)
      )
      .toBeGreaterThan(0)

    const documentOverflowAfterScroll = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(documentOverflowAfterScroll).toBeLessThanOrEqual(1)
    await expectWindowLocked(page)
  }
})

test("narrow viewports start with the filter controls collapsed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 480, height: 800 })
  await login(page, "admin@example.com", "adminpass")

  const screens = [
    {
      path: "/roles",
      control: page.getByRole("textbox", { name: "Title", exact: true }),
    },
    {
      path: "/tasks",
      control: page.getByRole("combobox", { name: "Status", exact: true }),
    },
    {
      path: "/users",
      control: page.getByRole("textbox", { name: "Search users" }),
    },
  ]

  for (const screen of screens) {
    await page.goto(screen.path)
    await expect(page.getByRole("table")).toBeVisible()

    // Compact by default: the controls stay out of the way until requested.
    await expect(screen.control).toHaveCount(0)

    await page.getByRole("button", { name: "Filters", exact: true }).click()
    await expect(screen.control).toBeVisible()
  }
})

test("a very short viewport falls back to content-region scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 420 })
  await login(page, "admin@example.com", "adminpass")
  await page.goto("/roles")
  await expect(page.getByRole("table")).toBeVisible()

  const initial = await frameGeometry(page)
  expect(initial.regionScrollHeight).toBeGreaterThan(initial.regionClientHeight)
  const body = await scrollGeometry(page)
  expect(body).not.toBeNull()
  expect(body!.scrollClientHeight).toBeGreaterThanOrEqual(240)
  await expectWindowLocked(page)

  // Nothing is clipped: the content region scrolls to reveal the footer.
  const pagination = page.getByRole("navigation", { name: "Pagination" })
  await expect(pagination).not.toBeInViewport()
  await page.locator(CONTENT_REGION).evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight })
  })
  await expect
    .poll(() =>
      page.locator(CONTENT_REGION).evaluate((element) => element.scrollTop)
    )
    .toBeGreaterThan(0)
  await expect(pagination).toBeInViewport()
  await expectWindowLocked(page)
})

test("the loading skeleton fills the frame and clips extra rows", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  // Hold the Roles list request so the loading branch paints.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (url.includes("/api/roles") && !url.includes("/api/roles/")) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(originalFetch(input, init)), 1500)
        })
      }
      return originalFetch(input, init)
    }
  })

  await page.goto("/roles")
  const skeleton = page.locator('[data-slot="table-skeleton"]')
  await expect(skeleton).toBeVisible()

  await expectWindowLocked(page)
  await expectFrameFitted(page)
  await expect(
    page.locator('[data-slot="table-skeleton-footer"]')
  ).toBeVisible()

  // Every placeholder row is in the DOM for the active page size, but the
  // fitted grid clips all but the visible ones instead of growing the page.
  await expect(page.locator('[data-slot="table-skeleton-row"]')).toHaveCount(30)
  const metrics = await skeleton.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(metrics.clientHeight).toBeGreaterThanOrEqual(240)
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)

  await expect(page.getByRole("table")).toBeVisible()
})

async function stubRolesList(
  page: Page,
  mode: "empty" | "error"
): Promise<void> {
  await page.addInitScript((kind) => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (url.includes("/api/roles") && !url.includes("/api/roles/")) {
        if (kind === "empty") {
          return Promise.resolve(
            new Response("[]", {
              status: 200,
              headers: {
                "content-type": "application/json",
                "x-total-count": "0",
              },
            })
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: "server_error",
              message: "Simulated failure",
            }),
            {
              status: 500,
              headers: { "content-type": "application/json" },
            }
          )
        )
      }
      return originalFetch(input, init)
    }
  }, mode)
}

test("the empty state fills the fitted frame without pagination", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await stubRolesList(page, "empty")
  await page.goto("/roles")

  await expect(page.getByText("No roles found.")).toBeVisible()
  await expect(page.getByRole("table")).toHaveCount(0)
  await expect(page.locator(TABLE_FOOTER)).toHaveCount(0)
  await expectWindowLocked(page)
  await expectFrameFitted(page)
  await expect(page.locator(PAGE_FRAME)).toContainText("No roles found.")
})

test("the no-match state fills the fitted frame", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await page.goto("/tasks")
  await expect(page.getByRole("table")).toBeVisible()

  await page.getByRole("textbox", { name: "Search tasks" }).fill("no-such-task")

  await expect(
    page.getByText("No tasks match your search or filters.")
  ).toBeVisible()
  await expect(page.getByRole("table")).toHaveCount(0)
  await expect(page.locator(TABLE_FOOTER)).toHaveCount(0)
  await expectWindowLocked(page)
  await expectFrameFitted(page)
})

test("the error state fills the fitted frame without pagination", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await stubRolesList(page, "error")
  await page.goto("/roles")

  const alert = page.getByRole("alert")
  // The app keeps React Query's default retries, so the failure surfaces
  // after the backoff rather than immediately.
  await expect(alert).toContainText("Could not load roles.", {
    timeout: 15_000,
  })
  await expect(alert).toContainText("Simulated failure")
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  await expect(page.locator(TABLE_FOOTER)).toHaveCount(0)
  await expectWindowLocked(page)
  await expectFrameFitted(page)
})

test("a Member gets the same fitted, body-scrolling tables", async ({
  page,
}) => {
  await login(page, "member@example.com", "memberpass")

  for (const screen of SCREENS) {
    await page.goto(screen.path)
    await expect(screen.ready(page)).toBeVisible()
    await expect(page.getByRole("table")).toBeVisible()

    await expectWindowLocked(page)
    await expectFrameFitted(page)
    await expect(screen.filters(page)).toBeVisible()
    await expect(page.locator(TABLE_FOOTER)).toBeVisible()
    await expect(page.locator(TABLE_FOOTER)).toBeInViewport()
  }

  // Read-only use has no selection or row actions.
  await expect(page.getByRole("checkbox")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0)
})
