import { expect, test, type Locator, type Page } from "@playwright/test"

import {
  SPACER_ROW,
  TABLE_FOOTER,
  TABLE_SCROLL,
  expectLogicalRowCount,
  expectWindowLocked,
  login,
  logicalRowCount,
  rowByText,
  scrollRowIntoView,
  tableRows,
} from "./helpers"

async function openRoles(page: Page, search = "") {
  await login(page, "admin@example.com", "adminpass")
  await page.goto(`/roles${search}`)
  await expect(page.getByRole("table")).toBeVisible()
}

/** The body scroll offset, used by the restored-URL assertions. */
function bodyScrollTop(page: Page): Promise<number> {
  return page
    .locator(TABLE_SCROLL)
    .evaluate((element) => (element as HTMLElement).scrollTop)
}

async function scrollBodyToEnd(page: Page) {
  await page.locator(TABLE_SCROLL).evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
}

/** The mounted edge of the body after scrolling to the end. */
function readEndGeometry(page: Page) {
  return page.evaluate(
    ({ scrollSelector, spacerSelector }) => {
      const scroll = document.querySelector(scrollSelector) as HTMLElement
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>(
          'tbody tr[data-slot="table-row"]'
        )
      )
      const last = rows[rows.length - 1]
      const spacer = document.querySelector(spacerSelector + ":last-child")
      return {
        lastIndex: last?.getAttribute("data-index") ?? null,
        bottomGap: last
          ? Math.round(
              scroll.getBoundingClientRect().bottom -
                last.getBoundingClientRect().bottom
            )
          : Number.POSITIVE_INFINITY,
        trailingSpacerHeight: spacer
          ? Math.round(spacer.getBoundingClientRect().height)
          : -1,
      }
    },
    { scrollSelector: TABLE_SCROLL, spacerSelector: SPACER_ROW }
  )
}

test("virtualizes the body and reveals the last logical row without a gap", async ({
  page,
}) => {
  // A 60-row page is larger than the mounted window at the default desktop
  // viewport, so virtualization is observable through the DOM.
  await openRoles(page, "?pageSize=100")

  // The logical page count comes from the row model, not the mounted DOM.
  await expectLogicalRowCount(page, 60)
  const logical = await logicalRowCount(page)
  const mounted = await tableRows(page).count()
  expect(mounted).toBeGreaterThan(0)
  expect(mounted).toBeLessThan(logical)

  // The last row (oldest under the default `updatedAt` descending sort) is not
  // mounted until the body is scrolled.
  await expect(rowByText(page, "Demo Role 01")).toHaveCount(0)

  // Two hidden spacer rows frame the mounted window and carry no content.
  const spacers = page.locator(SPACER_ROW)
  await expect(spacers).toHaveCount(2)
  for (const index of [0, 1]) {
    const spacer = spacers.nth(index)
    await expect(spacer).toHaveAttribute("aria-hidden", "true")
    await expect(spacer).toHaveAttribute("role", "none")
    expect(await spacer.textContent()).toBe("")
  }

  await scrollBodyToEnd(page)
  const lastRow = await scrollRowIntoView(page, rowByText(page, "Demo Role 01"))
  await expect(lastRow).toBeVisible()

  // No blank gap: at the end of the scroll the last logical row sits flush
  // with the bottom of the body, and the trailing spacer has collapsed.
  await scrollBodyToEnd(page)
  await expect
    .poll(async () => {
      const geometry = await readEndGeometry(page)
      return (
        geometry.lastIndex === "59" &&
        geometry.bottomGap <= 1 &&
        geometry.trailingSpacerHeight <= 1
      )
    })
    .toBe(true)

  await expectWindowLocked(page)
})

test("exposes the logical row count and indexes while only some rows are mounted", async ({
  page,
}) => {
  await openRoles(page, "?pageSize=100")
  await expectLogicalRowCount(page, 60)

  // The accessible total covers the logical data rows plus the header.
  const table = page.getByRole("table")
  await expect(table).toHaveAttribute("aria-rowcount", "61")

  // Each mounted row keeps its index in the full logical row space.
  const rows = tableRows(page)
  const mounted = await rows.count()
  expect(mounted).toBeGreaterThan(0)
  for (let index = 0; index < mounted; index += 1) {
    const row = rows.nth(index)
    const dataIndex = Number(await row.getAttribute("data-index"))
    expect(Number(await row.getAttribute("aria-rowindex"))).toBe(dataIndex + 2)
  }

  // Spacer rows are aria-hidden and role="none", so the accessibility tree
  // contains the header and only the mounted data rows.
  await expect(page.getByRole("row")).toHaveCount(mounted + 1)

  // The same contract holds after the window moves.
  await scrollBodyToEnd(page)
  await scrollRowIntoView(page, rowByText(page, "Demo Role 01"))
  await expect(table).toHaveAttribute("aria-rowcount", "61")
})

/**
 * Register extra members through the mock API so the Users page has enough
 * rows to virtualize. `login` has already started the worker and seeded it.
 */
async function seedUsers(page: Page, count: number): Promise<void> {
  await page.evaluate(async (total) => {
    for (let index = 1; index <= total; index += 1) {
      const suffix = String(index).padStart(2, "0")
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `Load User ${suffix}`,
          email: `load-user-${suffix}@example.com`,
          password: "loadpass",
        }),
      })
      if (!response.ok) {
        throw new Error(
          `Failed to register Load User ${suffix}: ${response.status}`
        )
      }
    }
  }, count)
}

/**
 * A Users row must be measured taller than the 36px estimate (the role
 * SelectTrigger makes it ~48px) and contain that trigger, or the virtualizer
 * fell back to the estimate and would clip the control.
 */
async function expectMeasuredUsersRow(row: Locator): Promise<void> {
  await expect
    .poll(async () => (await row.boundingBox())?.height ?? 0)
    .toBeGreaterThan(36)

  const rowBox = await row.boundingBox()
  const triggerBox = await row.getByLabel(/^Role for /).boundingBox()
  expect(rowBox).not.toBeNull()
  expect(triggerBox).not.toBeNull()
  if (!rowBox || !triggerBox) return

  const tolerance = 0.5
  expect(triggerBox.y).toBeGreaterThanOrEqual(rowBox.y - tolerance)
  expect(triggerBox.y + triggerBox.height).toBeLessThanOrEqual(
    rowBox.y + rowBox.height + tolerance
  )
  expect(triggerBox.x).toBeGreaterThanOrEqual(rowBox.x - tolerance)
  expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(
    rowBox.x + rowBox.width + tolerance
  )
}

test("measures the taller Users role rows without overlap or clipping", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  // Load the table first so the page-side mock worker is serving requests
  // before we register the extra rows.
  await page.goto("/users")
  await expect(page.getByRole("table")).toBeVisible()
  await seedUsers(page, 40)
  await page.goto("/users?pageSize=100")
  await expect(page.getByRole("table")).toBeVisible()
  await expectLogicalRowCount(page, 42)

  // A first-viewport row is measured, not left at the estimate.
  const firstRow = tableRows(page).first()
  await expect(firstRow).toBeVisible()
  await expectMeasuredUsersRow(firstRow)

  // Rows that enter the window later are measured too: scroll to the middle
  // of the logical list and assert a row that was outside the initial window.
  const midRow = await scrollRowIntoView(page, rowByText(page, "Load User 20"))
  await expect(midRow).toBeVisible()
  await expectMeasuredUsersRow(midRow)
})

test("a shared or restored URL opens the body at the top", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")

  // Page 2 of the 60-row list is a mid-list URL; the body must still open at
  // its top so the page's first result is visible.
  await page.goto("/roles?page=2&pageSize=30")
  await expect(page.getByRole("table")).toBeVisible()
  await expectLogicalRowCount(page, 30)

  const firstLogicalRow = page.locator(
    'tbody tr[data-slot="table-row"][data-index="0"]'
  )
  await expect(firstLogicalRow).toBeInViewport()
  await expect.poll(() => bodyScrollTop(page)).toBe(0)

  // Scrolling the body then reloading must not restore that offset.
  await page.locator(TABLE_SCROLL).evaluate((element) => {
    ;(element as HTMLElement).scrollTop = 320
  })
  await expect.poll(() => bodyScrollTop(page)).toBeGreaterThan(0)

  await page.reload()
  await expect(page.getByRole("table")).toBeVisible()
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => bodyScrollTop(page)).toBe(0)
  await expect(
    page.locator('tbody tr[data-slot="table-row"][data-index="0"]')
  ).toBeInViewport()
})

test("focusing a mounted row below the visible edge keeps it clear of the sticky header", async ({
  page,
}) => {
  await openRoles(page, "?pageSize=100")

  // Overscan mounts rows below the visible edge. Pick the first one so the
  // focus scroll has to move the body.
  const belowFoldIndex = await page.evaluate((scrollSelector) => {
    const scroll = document.querySelector(scrollSelector) as HTMLElement
    const bottom = scroll.getBoundingClientRect().bottom
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('tbody tr[data-slot="table-row"]')
    )
    const below = rows.find(
      (row) => row.getBoundingClientRect().top >= bottom + 1
    )
    return below?.getAttribute("data-index") ?? null
  }, TABLE_SCROLL)
  expect(belowFoldIndex).not.toBeNull()

  const row = page.locator(
    `tbody tr[data-slot="table-row"][data-index="${belowFoldIndex}"]`
  )
  await expect(row).toHaveCount(1)
  const edit = row.getByRole("button", { name: "Edit" })
  await expect(edit).toHaveCount(1)

  // Focus in the page (not through Playwright's actionability scroll) so the
  // browser's own focus scrolling runs and honours the scroll padding.
  await edit.evaluate((element) => (element as HTMLElement).focus())

  await expect(row).toBeInViewport()

  const headerBox = await page
    .getByRole("columnheader", { name: "Title" })
    .boundingBox()
  const rowBox = await row.boundingBox()
  expect(headerBox).not.toBeNull()
  expect(rowBox).not.toBeNull()
  if (!headerBox || !rowBox) return
  // `scroll-pt-10` matches the 40px sticky header, so the focused row is not
  // hidden beneath it.
  expect(rowBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
})

test("keeps the header and pagination pinned while the body scrolls", async ({
  page,
}) => {
  await openRoles(page)

  const header = page.getByRole("columnheader", { name: "Title" })
  const headerTop = (await header.boundingBox())?.y ?? 0
  await expect(page.locator(TABLE_FOOTER)).toBeInViewport()

  await page.locator(TABLE_SCROLL).evaluate((element) => {
    element.scrollTop = 320
  })
  await expect
    .poll(() =>
      page.locator(TABLE_SCROLL).evaluate((element) => element.scrollTop)
    )
    .toBe(320)

  const scrollTop = await page
    .locator(TABLE_SCROLL)
    .evaluate((element) => element.getBoundingClientRect().top)
  const pinnedTop = (await header.boundingBox())?.y ?? 0
  expect(Math.abs(pinnedTop - headerTop)).toBeLessThanOrEqual(1)
  expect(Math.abs(pinnedTop - scrollTop)).toBeLessThanOrEqual(1)

  await expect(page.locator(TABLE_FOOTER)).toBeInViewport()
  await expectWindowLocked(page)
})

test("selection, select-all, and a bulk action survive scrolling past the window", async ({
  page,
}) => {
  await openRoles(page)

  const bulkBar = page.getByRole("region", { name: "Bulk actions" })
  const selectAll = page.getByRole("checkbox", {
    name: "Select all roles on this page",
  })

  // Select a first-viewport row, then scroll it out of the mounted window.
  const firstRowCheckbox = page.getByRole("checkbox", { name: "Select Member" })
  await firstRowCheckbox.click()
  await expect(bulkBar).toContainText("1 selected")

  await scrollBodyToEnd(page)
  // Wait for the late row to mount; its node is remeasured and rerendered,
  // so the auto-retrying locator is safer than a one-shot scroll into view.
  await expect(rowByText(page, "Demo Role 31")).toBeVisible()
  await expect(bulkBar).toContainText("1 selected")

  // Select-all is page-scoped: it reports every row on the page even though
  // only a window is mounted, and a late row reflects it when it remounts.
  await selectAll.click()
  await expect(page.getByText("30 selected", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("checkbox", { name: "Select Demo Role 31" })
  ).toBeChecked()

  // Clear, then act on a late row: the bulk action receives the unmounted-at-
  // page-load record, not just rows that were mounted at selection time.
  await selectAll.click()
  await expect(bulkBar).toHaveCount(0)
  await scrollBodyToEnd(page)
  await expect(rowByText(page, "Demo Role 31")).toBeVisible()
  await page.getByRole("checkbox", { name: "Select Demo Role 31" }).click()
  await expect(bulkBar).toContainText("1 selected")
  await expect(rowByText(page, "Demo Role 31")).toBeVisible()

  await bulkBar.getByRole("button", { name: "Delete", exact: true }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(
    dialog.getByRole("heading", { name: "Delete 1 roles?" })
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Delete roles" }).click()

  await expect(
    page.getByText("Roles deleted: 1", { exact: true })
  ).toBeVisible()
  // The total dropping is the logical proof; a missing mounted row is not.
  await expect(page.getByText("59 roles", { exact: true })).toBeVisible()
  await expectLogicalRowCount(page, 30)
  await scrollBodyToEnd(page)
  await expect(rowByText(page, "Demo Role 31")).toHaveCount(0)
})
