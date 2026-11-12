import { expect, test, type Page } from "@playwright/test"

// The Due date filter maps date-only URL bounds to local-day UTC instants. Pin
// the browser to UTC so the seeded noon-UTC Due dates and the test's expected
// date strings line up deterministically.
test.use({ timezoneId: "UTC" })

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function openTasks(page: Page) {
  await page.locator('[data-sidebar="menu-button"]', { hasText: "Tasks" }).click()
  await expect(page).toHaveURL(/\/dashboard\/tasks/)
  await expect(page.getByRole("table")).toBeVisible()
}

async function openDueDateFilter(page: Page) {
  await page.locator("#tasks-due-date-filter").click()
}

/** Jumps the first visible calendar month to a known month and year. */
async function showMonth(page: Page, year: string, month: string) {
  const firstMonth = page.locator('[data-slot="calendar"] .rdp-month').first()
  await firstMonth.getByLabel("Choose the Year").selectOption(year)
  await firstMonth.getByLabel("Choose the Month").selectOption(month)
}

test("filters the table by status", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  await expect(page.getByText("Author the OpenAPI contract")).toBeVisible()
  await expect(page.getByText("Build the MSW mock")).toBeVisible()

  await page.getByLabel("Status").click()
  await page.getByRole("option", { name: "done" }).click()

  await expect(page).toHaveURL(/status=done/)
  await expect(page.getByText("Author the OpenAPI contract")).toBeVisible()
  await expect(page.getByText("Build the MSW mock")).toHaveCount(0)
})

test("selects a row and applies a bulk status update", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  // Bulk actions are faded (disabled) until a selection is made.
  await expect(
    page.getByRole("button", { name: "Update status" })
  ).toBeDisabled()

  const row = page.getByRole("row").filter({ hasText: "Build the MSW mock" })
  await row.getByRole("checkbox").click()
  await expect(page.getByText("1 selected")).toBeVisible()

  await page.getByRole("button", { name: "Update status" }).click()
  await page.getByRole("menuitem", { name: "done" }).click()

  await expect(page.getByText("Updated 1 tasks")).toBeVisible()
})

test("paginates and reflects the page in the URL", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  const pagination = page.getByRole("navigation", { name: "Pagination" })
  await expect(pagination).toBeVisible()
  await expect(pagination.getByRole("button", { name: "Page 2" })).toBeVisible()

  await pagination.getByRole("button", { name: "Page 2" }).click()
  await expect(page).toHaveURL(/page=2/)
})

test("changes rows per page and resets to page one", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  const pagination = page.getByRole("navigation", { name: "Pagination" })
  await pagination.getByRole("button", { name: "Page 2" }).click()
  await expect(page).toHaveURL(/page=2/)

  await page.getByLabel("Rows per page").click()
  await page.getByRole("option", { name: "10", exact: true }).click()

  await expect(page).toHaveURL(/pageSize=10/)
  await expect(page).not.toHaveURL(/page=/)
})

test("filters the table by a custom due date range", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  await openDueDateFilter(page)
  await showMonth(page, "2026", "0")
  await page.getByRole("button", { name: /January 2nd, 2026/, exact: false }).click()
  await page.getByRole("button", { name: /January 3rd, 2026/, exact: false }).click()

  await expect(page).toHaveURL(/dueFrom=2026-01-02/)
  await expect(page).toHaveURL(/dueTo=2026-01-03/)
  await expect(page.getByText("Review the login flow #4")).toBeVisible()
  await expect(page.getByText("Fix the table pagination #5")).toBeVisible()
  await expect(page.getByText("Author the OpenAPI contract")).toHaveCount(0)
})

test("filters the table with a due date preset", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  const today = new Date().toISOString().slice(0, 10)

  await openDueDateFilter(page)
  await page.getByRole("button", { name: "Today", exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`dueFrom=${today}`))
  await expect(page).toHaveURL(new RegExp(`dueTo=${today}`))
  await expect(page.locator("#tasks-due-date-filter")).not.toContainText(
    "Any due date"
  )
  // Tasks without a Due date never match a range filter.
  await expect(page.getByText("Author the OpenAPI contract")).toHaveCount(0)
})

test("filters the table by an upper bound only", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  await openDueDateFilter(page)
  await page.getByRole("button", { name: "Until", exact: true }).click()
  await showMonth(page, "2026", "0")
  await page.getByRole("button", { name: /January 3rd, 2026/, exact: false }).click()

  await expect(page).toHaveURL(/dueTo=2026-01-03/)
  await expect(page).not.toHaveURL(/dueFrom=/)
  await expect(page.getByText("Review the login flow #4")).toBeVisible()
  await expect(page.getByText("Fix the table pagination #5")).toBeVisible()
  await expect(page.getByText(/Write unit tests for search/)).toHaveCount(0)
})
