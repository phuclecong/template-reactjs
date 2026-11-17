import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

// The URL stores picked calendar days, the API request converts them to local
// start/end-of-day instants, and the seed timestamps are UTC. Pin the browser
// to UTC so the picked days, the request bounds, and the rendered rows line up
// deterministically.
test.use({ timezoneId: "UTC" })

type UrlFilterValue = string | string[]

type UrlFilter = { field: string; operator: string; value: UrlFilterValue }

/**
 * Read the table's flat query parameters back as CrudFilter-shaped values.
 * Defaults (sort `updatedAt`/`desc`, page 1, page size 30) are omitted.
 */
function readFilters(page: Page): UrlFilter[] {
  const params = new URL(page.url()).searchParams
  const filters: UrlFilter[] = []

  const title = params.get("title")
  if (title)
    filters.push({ field: "title", operator: "contains", value: title })

  const description = params.get("description")
  if (description) {
    filters.push({
      field: "description",
      operator: "contains",
      value: description,
    })
  }

  // Multi-value filters are stored as one comma-joined parameter.
  const status = params.get("status")
  if (status) {
    const values = status.split(",")
    filters.push({
      field: "status",
      operator: values.length > 1 ? "in" : "eq",
      value: values.length > 1 ? values : values[0],
    })
  }

  const dateBounds = [
    ["createdAtFrom", "createdAt", "gte"],
    ["createdAtTo", "createdAt", "lte"],
    ["updatedAtFrom", "updatedAt", "gte"],
    ["updatedAtTo", "updatedAt", "lte"],
  ] as const
  for (const [param, field, operator] of dateBounds) {
    const value = params.get(param)
    if (value) filters.push({ field, operator, value })
  }

  return filters
}

async function expectFilter(
  page: Page,
  field: string,
  operator: string,
  value: UrlFilterValue
) {
  await expect
    .poll(() => readFilters(page))
    .toContainEqual({ field, operator, value })
}

async function expectSorter(page: Page, field: string, order: string) {
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams
      return {
        field: params.get("sort") ?? "updatedAt",
        order: params.get("order") ?? "desc",
      }
    })
    .toEqual({ field, order })
}

async function openRoles(page: Page) {
  await page.getByRole("link", { name: "Roles" }).click()
  await expect(page).toHaveURL(/\/roles/)
  await expect(page.getByRole("table")).toBeVisible()
}

function titleFilter(page: Page) {
  return page.getByRole("textbox", { name: "Title", exact: true })
}

function descriptionFilter(page: Page) {
  return page.getByRole("textbox", { name: "Description", exact: true })
}

function statusFilter(page: Page) {
  return page.getByLabel("Status", { exact: true })
}

async function selectStatus(page: Page, label: string) {
  await statusFilter(page).click()
  await page.getByRole("option", { name: label, exact: true }).click()
  // Multi-select keeps the popup open after a pick; close it so later
  // interactions are not covered by the popup.
  await page.keyboard.press("Escape")
}

async function openCreatedRange(page: Page) {
  await page.locator("#roles-created-at-filter").click()
}

async function openUpdatedRange(page: Page) {
  await page.locator("#roles-updated-at-filter").click()
}

/** Jumps the first visible calendar month to a known month and year. */
async function showMonth(page: Page, year: string, month: string) {
  const firstMonth = page.locator('[data-slot="calendar"] .rdp-month').first()
  await firstMonth.getByLabel("Choose the Year").selectOption(year)
  await firstMonth.getByLabel("Choose the Month").selectOption(month)
}

test("filters by title with a debounced contains match", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await titleFilter(page).fill("demo role 42")

  // The input is debounced: the URL does not gain the filter immediately…
  await page.waitForTimeout(100)
  expect(readFilters(page)).toHaveLength(0)

  // …but lands after the 300 ms debounce with a case-insensitive contains.
  await expectFilter(page, "title", "contains", "demo role 42")
  await expect(page.getByText("Title contains: demo role 42")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(1)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 42")
  await expect(page.getByText("Demo Role 43")).toHaveCount(0)
})

test("filters by description with a contains match", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await descriptionFilter(page).fill("demo role 42")

  await expectFilter(page, "description", "contains", "demo role 42")
  await expect(
    page.getByText("Description contains: demo role 42")
  ).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(1)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 42")
})

test("combines title, description, and status filters with AND semantics", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await titleFilter(page).fill("Demo Role 4")
  await expectFilter(page, "title", "contains", "Demo Role 4")
  await expect(page.locator("tbody tr")).toHaveCount(10)

  await selectStatus(page, "Inactive")
  await expectFilter(page, "status", "eq", "inactive")
  await expect(page.locator("tbody tr")).toHaveCount(5)

  await descriptionFilter(page).fill("demo role 44")
  await expectFilter(page, "description", "contains", "demo role 44")
  await expect(page.locator("tbody tr")).toHaveCount(1)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 44")
})

test("status filter selects one or several statuses", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  // No selection is the default: both active and inactive Roles are listed.
  await expect(page.getByText("60 roles")).toBeVisible()
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText("Inactive", { exact: true }).first()
  ).toBeVisible()
  expect(readFilters(page)).toHaveLength(0)

  await selectStatus(page, "Inactive")
  await expectFilter(page, "status", "eq", "inactive")
  await expect(page.getByText("29 roles")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(29)
  await expect(
    page.locator("tbody").getByText("Inactive", { exact: true })
  ).toHaveCount(29)

  // Adding a second status widens the match to either value (OR within the
  // field) and stores both in an `in` filter.
  await selectStatus(page, "Active")
  await expectFilter(page, "status", "in", ["inactive", "active"])
  await expect(page.getByText("60 roles")).toBeVisible()
  await expect(page.getByText("Status: Inactive, Active")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(30)

  // Deselecting one status narrows the filter back to the other.
  await page.getByRole("button", { name: "Remove Active", exact: true }).click()
  await expectFilter(page, "status", "eq", "inactive")
  await expect(page.getByText("29 roles")).toBeVisible()
})

test("filters by an inclusive created-date range stored as local days", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await openCreatedRange(page)
  await showMonth(page, "2026", "0")
  await page
    .getByRole("button", { name: /January 2nd, 2026/, exact: false })
    .click()
  await page
    .getByRole("button", { name: /January 3rd, 2026/, exact: false })
    .click()

  // The URL stores the picked calendar days; the API request converts them to
  // the local start of the From day and the local end of the To day.
  await expectFilter(page, "createdAt", "gte", "2026-01-02")
  await expectFilter(page, "createdAt", "lte", "2026-01-03")

  // Both boundary days are included: their noon-UTC seeds match.
  await expect(page.locator("tbody tr")).toHaveCount(2)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 03")
  await expect(page.locator("tbody tr").nth(1)).toContainText("Demo Role 02")
  await expect(page.getByText("Created: 2026-01-02 – 2026-01-03")).toBeVisible()

  // The picker shows the stored instants back as local calendar days.
  await expect(page.locator("#roles-created-at-filter")).toContainText(
    "Jan 2 – 3, 2026"
  )

  // Both bounds survive a reload from the URL, not just the first one.
  await page.reload()
  await expect(page.getByRole("table")).toBeVisible()
  await expectFilter(page, "createdAt", "gte", "2026-01-02")
  await expectFilter(page, "createdAt", "lte", "2026-01-03")
  await expect(page.locator("tbody tr")).toHaveCount(2)
  await expect(page.locator("#roles-created-at-filter")).toContainText(
    "Jan 2 – 3, 2026"
  )
})

test("filters by an inclusive updated-date range", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await openUpdatedRange(page)
  await showMonth(page, "2026", "2")
  await page
    .getByRole("button", { name: /March 2nd, 2026/, exact: false })
    .click()
  await page
    .getByRole("button", { name: /March 3rd, 2026/, exact: false })
    .click()

  await expectFilter(page, "updatedAt", "gte", "2026-03-02")
  await expectFilter(page, "updatedAt", "lte", "2026-03-03")

  await expect(page.locator("tbody tr")).toHaveCount(2)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 03")
  await expect(page.locator("tbody tr").nth(1)).toContainText("Demo Role 02")
  await expect(page.getByText("Updated: 2026-03-02 – 2026-03-03")).toBeVisible()
})

test("removes individual filter chips and clears all filters", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await titleFilter(page).fill("demo role 42")
  await expectFilter(page, "title", "contains", "demo role 42")
  await selectStatus(page, "Inactive")
  await expectFilter(page, "status", "eq", "inactive")
  await expect(page.locator("tbody tr")).toHaveCount(1)

  await page
    .getByRole("button", { name: "Remove Status: Inactive", exact: true })
    .click()

  await expect.poll(() => readFilters(page)).toEqual([
    { field: "title", operator: "contains", value: "demo role 42" },
  ])
  await expect(page.getByText("Status: Inactive")).toHaveCount(0)
  await expect(page.locator("tbody tr")).toHaveCount(1)

  await page.getByRole("button", { name: "Clear all", exact: true }).click()

  await expect.poll(() => readFilters(page)).toHaveLength(0)
  await expect(page.getByText("Title contains: demo role 42")).toHaveCount(0)
  await expect(titleFilter(page)).toHaveValue("")
  await expect(page.getByText("60 roles")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(30)
})

test("changing a filter resets pagination to page 1", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(page).toHaveURL(/[?&]page=2\b/)

  await selectStatus(page, "Active")

  await expectFilter(page, "status", "eq", "active")
  // Page 1 is the default and is therefore omitted from the URL.
  await expect
    .poll(() => new URL(page.url()).searchParams.has("page"))
    .toBe(false)
  await expect(page.getByText("31 roles")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(30)
})

test("restores filters, sort, and page from the URL after reload", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await titleFilter(page).fill("Demo Role")
  await expectFilter(page, "title", "contains", "Demo Role")
  await expect(page.getByText("58 roles")).toBeVisible()

  const titleHeader = page.getByRole("button", { name: "Title", exact: true })
  await titleHeader.click()
  await expectSorter(page, "title", "asc")

  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(page).toHaveURL(/[?&]page=2\b/)
  await expect(page.locator("tbody tr")).toHaveCount(28)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 31")

  await page.reload()
  await expect(page.getByRole("table")).toBeVisible()

  await expect(page).toHaveURL(/[?&]page=2\b/)
  await expectSorter(page, "title", "asc")
  await expectFilter(page, "title", "contains", "Demo Role")

  await expect(titleFilter(page)).toHaveValue("Demo Role")
  await expect(page.getByText("Title contains: Demo Role")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(28)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 31")
})

test("members can filter the read-only catalogue", async ({ page }) => {
  await login(page, "member@example.com", "memberpass")
  await openRoles(page)

  await titleFilter(page).fill("demo role 42")
  await expectFilter(page, "title", "contains", "demo role 42")
  await expect(page.locator("tbody tr")).toHaveCount(1)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 42")

  // Filtering never reveals write controls to a Member.
  await expect(
    page.getByRole("button", { name: "Create role", exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole("checkbox")).toHaveCount(0)
})
