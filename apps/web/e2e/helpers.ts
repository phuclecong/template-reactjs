import { expect, type Locator, type Page } from "@playwright/test"

/**
 * The single scroll container inside the fitted table. It carries the
 * logical page row count in `data-row-count`, which stays correct even when a
 * virtualizer mounts only a subset of rows.
 */
export const TABLE_SCROLL = '[data-slot="table-scroll"]'

/**
 * The logical data rows for the current page. The `data-slot` filter excludes
 * the header row and any virtualizer spacer rows, so this matches data rows
 * whether or not virtualization is active.
 */
export function tableRows(page: Page): Locator {
  return page.locator('tbody tr[data-slot="table-row"]')
}

/** A logical data row found by visible text, built on {@link tableRows}. */
export function rowByText(page: Page, text: string | RegExp): Locator {
  return tableRows(page).filter({ hasText: text })
}

/**
 * Read the logical data row count for the current page. The count comes from
 * the table's row model via `data-row-count`, never from the number of mounted
 * `<tr>` elements, so it survives virtualization.
 */
export async function logicalRowCount(page: Page): Promise<number> {
  const raw = await page.locator(TABLE_SCROLL).getAttribute("data-row-count")
  if (raw === null) {
    throw new Error(
      "The table scroll element has no data-row-count; the table may be in a loading, empty, or error state."
    )
  }
  const count = Number(raw)
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`The table exposed an invalid data-row-count: ${raw}`)
  }
  return count
}

/** Poll the logical page row count until it reaches `expected`. */
export async function expectLogicalRowCount(
  page: Page,
  expected: number
): Promise<void> {
  await expect
    .poll(() => logicalRowCount(page), {
      message: `Expected the table's logical row count to be ${expected}`,
    })
    .toBe(expected)
}

export type ScrollRowIntoViewOptions = {
  /** Maximum number of body scroll steps before failing. */
  maxSteps?: number
  /** Pixels added to the body's `scrollTop` per step. */
  stepPx?: number
}

/**
 * Ensure a requested logical row is mounted, then scroll it into view.
 *
 * With every row mounted (before virtualization lands) this is effectively a
 * no-op: the row is found immediately and Playwright scrolls it into view.
 * Once the body virtualizes, an unmounted row has no DOM node, so this walks
 * the table body in bounded steps until the row mounts, then calls
 * `scrollIntoViewIfNeeded`. Use the locator returned by {@link rowByText} or
 * {@link tableRows} so the search never matches the header or a spacer row.
 *
 * Throws a clear error if the row never appears, which usually means it is not
 * on the current page or does not match the active filter.
 */
export async function scrollRowIntoView(
  page: Page,
  row: Locator,
  options: ScrollRowIntoViewOptions = {}
): Promise<Locator> {
  const { maxSteps = 120, stepPx = 240 } = options
  const target = row.first()
  const scroller = page.locator(TABLE_SCROLL)

  await expect(scroller).toBeVisible()

  // An unmounted row can be above the current position; start from the top so
  // the downward walk cannot skip it.
  if ((await target.count()) === 0) {
    await scroller.evaluate((element) => {
      element.scrollTop = 0
    })
  }

  for (let step = 0; step < maxSteps; step += 1) {
    if ((await target.count()) > 0) {
      // A list-state change can land while we walk: the row mounts, then a
      // reset or refetch detaches it and re-renders the window. A short
      // timeout keeps the walk moving instead of waiting out the test.
      try {
        await target.scrollIntoViewIfNeeded({ timeout: 1_500 })
        if ((await target.count()) > 0) return target
      } catch {
        // The row detached mid-scroll; keep stepping to remount it.
      }
    }

    const moved = await scroller.evaluate((element, amount) => {
      const before = element.scrollTop
      element.scrollTop = Math.min(before + amount, element.scrollHeight)
      return element.scrollTop !== before
    }, stepPx)

    // Give the virtualizer a frame to render rows near the new position.
    await page.waitForTimeout(25)

    if (!moved) break
  }

  // The list may still be settling: a debounced filter or a refetch can mount
  // the requested row after the walk reaches the end, and a list-state change
  // resets the body to the top. Give it a bounded grace period before failing.
  try {
    await expect
      .poll(() => target.count(), { timeout: 3_000 })
      .toBeGreaterThan(0)
  } catch {
    throw new Error(
      `Row was not mounted after scrolling the table body ${maxSteps} steps. ` +
        `Check that it exists on the current page and matches the active filters.`
    )
  }

  await target.scrollIntoViewIfNeeded()
  return target
}

/** Render an ISO instant the way the Roles screen does: local `YYYY-MM-DD HH:mm`. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Resolves once a full document load at `pathname` finishes.
 *
 * Auth success handlers navigate twice: Refine redirects on the client, then
 * the form hard-navigates so the session boots from sessionStorage. Only the
 * second navigation replaces the document. Start this wait before the click
 * that triggers the redirect; reloading or typing while that navigation is
 * still in flight aborts it (`net::ERR_ABORTED`) or discards the input.
 */
export function waitForDocumentLoad(page: Page, pathname: RegExp) {
  return page.waitForEvent("load", () =>
    pathname.test(new URL(page.url()).pathname)
  )
}

/** Sign in and wait until the dashboard document has loaded. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  const dashboardLoaded = waitForDocumentLoad(page, /^\/dashboard$/)
  await page.getByRole("button", { name: "Sign in" }).click()
  await dashboardLoaded
  await expect(page).toHaveURL(/\/dashboard$/)
}
