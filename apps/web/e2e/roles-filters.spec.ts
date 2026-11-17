import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

// Date bounds are stored as UTC instants for local start/end of day, and the
// seed timestamps are UTC. Pin the browser to UTC so the picked days, the URL
// instants, and the rendered rows line up deterministically.
test.use({ timezoneId: "UTC" })

type UrlFilter = { field: string; operator: string; value: string }

/** Read Refine's `filters[N][...]` table params from the current URL. */
function readFilters(page: Page): UrlFilter[] {
  const params = new URL(page.url()).searchParams
  const filters: UrlFilter[] = []
  for (let index = 0; params.has(`filters[${index}][field]`); index++) {
    filters.push({
      field: params.get(`filters[${index}][field]`) ?? "",
      operator: params.get(`filters[${index}][operator]`) ?? "",
      value: params.get(`filters[${index}][value]`) ?? "",
    })
  }
  return filters
}

async function expectFilter(
  page: Page,
  field: string,
  operator: string,
  value: string
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
        field: params.get("sorters[0][field]"),
        order: params.get("sorters[0][order]"),
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
  await expect(page.getByText("Description contains: demo role 42")).toBeVisible()
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

test("status filter offers All, Active, and Inactive", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  // All is the default: both active and inactive Roles are listed.
  await expect(page.getByText("60 roles")).toBeVisible()
  await expect(page.getByText("active", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("inactive", { exact: true }).first()).toBeVisible()
  expect(readFilters(page)).toHaveLength(0)

  await selectStatus(page, "Inactive")
  await expectFilter(page, "status", "eq", "inactive")
  await expect(page.getByText("29 roles")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(29)
  await expect(
    page.locator("tbody").getByText("inactive", { exact: true })
  ).toHaveCount(29)

  await selectStatus(page, "Active")
  await expectFilter(page, "status", "eq", "active")
  await expect(page.getByText("31 roles")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(30)

  await selectStatus(page, "All")
  await expect(page.getByText("60 roles")).toBeVisible()
  expect(readFilters(page)).toHaveLength(0)
})

test("filters by an inclusive created-date range stored as UTC instants", async ({
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

  // From is the local start of the day; To is the local end of the day.
  await expectFilter(page, "createdAt", "gte", "2026-01-02T00:00:00.000Z")
  await expectFilter(page, "createdAt", "lte", "2026-01-03T23:59:59.999Z")

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
  await expectFilter(page, "createdAt", "gte", "2026-01-02T00:00:00.000Z")
  await expectFilter(page, "createdAt", "lte", "2026-01-03T23:59:59.999Z")
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

  await expectFilter(page, "updatedAt", "gte", "2026-03-02T00:00:00.000Z")
  await expectFilter(page, "updatedAt", "lte", "2026-03-03T23:59:59.999Z")

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

  expect(readFilters(page)).toEqual([
    { field: "title", operator: "contains", value: "demo role 42" },
  ])
  await expect(page.getByText("Status: Inactive")).toHaveCount(0)
  await expect(page.locator("tbody tr")).toHaveCount(1)

  await page.getByRole("button", { name: "Clear all", exact: true }).click()

  expect(readFilters(page)).toHaveLength(0)
  await expect(page.getByText("Title contains: demo role 42")).toHaveCount(0)
  await expect(titleFilter(page)).toHaveValue("")
  await expect(page.getByText("60 roles")).toBeVisible()
  await expect(page.locator("tbody tr")).toHaveCount(30)
})

test("changing a filter resets pagination to page 1", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(page).toHaveURL(/currentPage=2/)

  await selectStatus(page, "Active")

  await expectFilter(page, "status", "eq", "active")
  await expect(page).toHaveURL(/currentPage=1/)
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
  await expect(page).toHaveURL(/currentPage=2/)
  await expect(page.locator("tbody tr")).toHaveCount(28)
  await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 31")

  await page.reload()
  await expect(page.getByRole("table")).toBeVisible()

  await expect(page).toHaveURL(/currentPage=2/)
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
