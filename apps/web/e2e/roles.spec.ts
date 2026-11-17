import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

/** Render an ISO instant the way the Roles screen does: local `YYYY-MM-DD HH:mm`. */
function formatLocalDateTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function openRoles(page: Page) {
  await page.getByRole("link", { name: "Roles" }).click()
  await expect(page).toHaveURL(/\/roles/)
  await expect(page.getByRole("table")).toBeVisible()
}

test("navigates to Roles and renders the server-paged default view", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  // Breadcrumb names the flat route.
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Roles")

  // Administrators get the create affordance on the list page.
  await expect(
    page.getByRole("button", { name: "Create role", exact: true })
  ).toBeVisible()

  // Administrators get the five data columns, the selection column, and the
  // row-action column; sortable headers are buttons, Description is not.
  await expect(page.getByRole("columnheader")).toHaveCount(7)
  for (const header of ["Title", "Status", "Created", "Updated"]) {
    await expect(
      page.getByRole("button", { name: header, exact: true })
    ).toBeVisible()
  }
  await expect(
    page.getByRole("columnheader", { name: "Description" })
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Actions" })
  ).toBeVisible()

  // Refine's URL state carries the default page, size, and updatedAt sort.
  await expect(page).toHaveURL(/currentPage=1/)
  await expect(page).toHaveURL(/pageSize=30/)
  await expect(page).toHaveURL(/sorters(\[|%5B)0(\]|%5D)(\[|%5B)field/)
  await expect(page).toHaveURL(/=updatedAt/)
  await expect(page).toHaveURL(/sorters(\[|%5B)0(\]|%5D)(\[|%5B)order/)
  await expect(page).toHaveURL(/=desc/)

  // updatedAt descending puts the newest System Role first, then the older one.
  const rows = page.locator("tbody tr")
  await expect(rows).toHaveCount(30)
  await expect(rows.nth(0)).toContainText("Member")
  await expect(rows.nth(1)).toContainText("Administrator")

  // Dates render in the local timezone as YYYY-MM-DD HH:mm.
  await expect(rows.nth(0)).toContainText(
    formatLocalDateTime("2026-06-02T00:00:00.000Z")
  )
  await expect(rows.nth(0)).toContainText(
    formatLocalDateTime("2025-12-02T00:00:00.000Z")
  )

  // Active and inactive Roles are both listed with status badges.
  await expect(rows.nth(0).getByText("active", { exact: true })).toBeVisible()
  await expect(rows.nth(2).getByText("inactive", { exact: true })).toBeVisible()

  // Long descriptions stay readable through a tooltip.
  const description = rows
    .nth(0)
    .getByText("Read-only access to the dashboard.", { exact: true })
  await expect(description).toBeVisible()
  await description.hover()
  await expect(page.locator('[data-slot="tooltip-content"]')).toContainText(
    "Read-only access to the dashboard."
  )
})

test("sorting headers cycle direction and write Refine sorters to the URL", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  const rows = page.locator("tbody tr")
  const titleHeader = page.getByRole("button", { name: "Title", exact: true })

  await titleHeader.click()
  await expect(page).toHaveURL(/=title/)
  await expect(page).toHaveURL(/=asc/)
  await expect(rows.nth(0)).toContainText("Administrator")

  await titleHeader.click()
  await expect(page).toHaveURL(/=title/)
  await expect(page).toHaveURL(/=desc/)
  await expect(rows.nth(0)).toContainText("Member")

  // A different sortable header replaces the active sorter.
  await page.getByRole("button", { name: "Status", exact: true }).click()
  await expect(page).toHaveURL(/=status/)
  await expect(page).toHaveURL(/=asc/)

  await page.getByRole("button", { name: "Updated", exact: true }).click()
  await expect(page).toHaveURL(/=updatedAt/)
  await expect(page).toHaveURL(/=asc/)
})

test("paginates on the server and changes the page size", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  const rows = page.locator("tbody tr")
  await expect(rows).toHaveCount(30)

  // The second page fetches its own 30 records from the list endpoint.
  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(page).toHaveURL(/currentPage=2/)
  await expect(rows).toHaveCount(30)
  await expect(rows.nth(0)).toContainText("Demo Role 30")

  // Changing page size resets to page 1 and re-queries with the new size.
  await page.getByLabel("Rows per page").click()
  await page.getByRole("option", { name: "10", exact: true }).click()
  await expect(page).toHaveURL(/pageSize=10/)
  await expect(page).toHaveURL(/currentPage=1/)
  await expect(rows).toHaveCount(10)
  await expect(rows.nth(0)).toContainText("Member")
})

test("restores sort, page, and page size from the URL after reload", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  const rows = page.locator("tbody tr")
  const titleHeader = page.getByRole("button", { name: "Title", exact: true })

  await titleHeader.click()
  await titleHeader.click()
  await expect(page).toHaveURL(/=title/)
  await expect(page).toHaveURL(/=desc/)

  await page.getByLabel("Rows per page").click()
  await page.getByRole("option", { name: "10", exact: true }).click()
  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(rows.nth(0)).toContainText("Demo Role 49")

  await page.reload()
  await expect(page.getByRole("table")).toBeVisible()

  // The URL, not the default updatedAt sort, drives the restored view.
  await expect(page).toHaveURL(/currentPage=2/)
  await expect(page).toHaveURL(/pageSize=10/)
  await expect(page).toHaveURL(/=title/)
  await expect(page).toHaveURL(/=desc/)
  await expect(rows).toHaveCount(10)
  await expect(rows.nth(0)).toContainText("Demo Role 49")
})

test("member sees the table and pagination without any action controls", async ({
  page,
}) => {
  await login(page, "member@example.com", "memberpass")
  await openRoles(page)

  const rows = page.locator("tbody tr")
  await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible()
  await expect(rows).toHaveCount(30)

  // Members still paginate the catalogue.
  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(page).toHaveURL(/currentPage=2/)
  await expect(rows.nth(0)).toContainText("Demo Role 30")

  // No create, edit, delete, selection, or row-action controls render.
  await expect(
    page.getByRole("button", { name: "Create role", exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole("checkbox")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0)
  await expect(page.getByRole("columnheader")).toHaveCount(5)
})
