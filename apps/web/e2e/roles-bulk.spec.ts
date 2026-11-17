import {
  expect,
  test,
  type ConsoleMessage,
  type Page,
} from "@playwright/test"

import { login } from "./helpers"

type ConsoleEntry = {
  kind?: string
  event?: string
  data?: Record<string, unknown>
}

async function findEvent(
  messages: ConsoleMessage[],
  event: string
): Promise<ConsoleEntry | undefined> {
  for (const message of messages) {
    const value = await message
      .args()[0]
      ?.jsonValue()
      .catch(() => undefined)
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as ConsoleEntry).kind === "event" &&
      (value as ConsoleEntry).event === event
    ) {
      return value as ConsoleEntry
    }
  }
  return undefined
}

async function openRoles(page: Page) {
  await page.getByRole("link", { name: "Roles" }).click()
  await expect(page).toHaveURL(/\/roles/)
  await expect(page.getByRole("table")).toBeVisible()
}

async function loginAsAdmin(page: Page) {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)
}

function bulkBar(page: Page) {
  return page.getByRole("region", { name: "Bulk actions" })
}

function selectAllCheckbox(page: Page) {
  return page.getByRole("checkbox", {
    name: "Select all roles on this page",
  })
}

function rowCheckbox(page: Page, title: string) {
  return page.getByRole("checkbox", { name: `Select ${title}` })
}

test("the header checkbox selects the current page and selection clears on page change", async ({
  page,
}) => {
  await loginAsAdmin(page)

  // Administrators get one checkbox per row plus the page-scoped header box.
  await expect(page.getByRole("checkbox")).toHaveCount(31)
  await expect(bulkBar(page)).toHaveCount(0)

  await selectAllCheckbox(page).click()
  await expect(selectAllCheckbox(page)).toBeChecked()
  await expect(page.getByText("30 selected", { exact: true })).toBeVisible()
  await expect(bulkBar(page)).toBeVisible()

  // Every row on the current page is selected, not merely the first page worth
  // of ids: page 1 runs from Member through Demo Role 31.
  await expect(rowCheckbox(page, "Member")).toBeChecked()
  await expect(rowCheckbox(page, "Demo Role 31")).toBeChecked()
  await expect(page.getByText("30 selected", { exact: true })).toBeVisible()

  // Changing page clears the selection and re-scopes the header checkbox.
  await page.getByLabel("Page 2", { exact: true }).click()
  await expect(page).toHaveURL(/currentPage=2/)
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(rowCheckbox(page, "Demo Role 30")).not.toBeChecked()

  await selectAllCheckbox(page).click()
  await expect(page.getByText("30 selected", { exact: true })).toBeVisible()
  await expect(rowCheckbox(page, "Demo Role 30")).toBeChecked()
  await expect(rowCheckbox(page, "Demo Role 01")).toBeChecked()
  // Page 1 rows are no longer part of the selection.
  await expect(page.getByText("30 selected", { exact: true })).toBeVisible()
})

test("bulk edit changes only the status and leaves untouched descriptions intact", async ({
  page,
}) => {
  await loginAsAdmin(page)

  // Demo Role 31 is active and has a description; Demo Role 32 is inactive and
  // has a description. Changing only the status must not touch either
  // description (the payload carries only dirty fields).
  await rowCheckbox(page, "Demo Role 31").click()
  await rowCheckbox(page, "Demo Role 32").click()
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible()

  await bulkBar(page).getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: "Edit 2 roles" })
  ).toBeVisible()

  await dialog.getByLabel("Status", { exact: true }).click()
  await page.getByRole("option", { name: "Active", exact: true }).click()
  await dialog.getByRole("button", { name: "Apply changes" }).click()

  await expect(
    page.getByText("Roles updated: 2", { exact: true })
  ).toBeVisible()
  await expect(bulkBar(page)).toHaveCount(0)

  const row31 = page.getByRole("row").filter({ hasText: "Demo Role 31" })
  const row32 = page.getByRole("row").filter({ hasText: "Demo Role 32" })
  await expect(row31.getByText("active", { exact: true })).toBeVisible()
  await expect(row32.getByText("active", { exact: true })).toBeVisible()
  await expect(
    row31.getByText("Description for demo role 31", { exact: true })
  ).toBeVisible()
  await expect(
    row32.getByText("Description for demo role 32", { exact: true })
  ).toBeVisible()
  await expect(row31).toContainText("Demo Role 31")
  await expect(row32).toContainText("Demo Role 32")
})

test("bulk edit can clear a description and sends null", async ({ page }) => {
  await loginAsAdmin(page)

  await rowCheckbox(page, "Demo Role 31").click()
  await bulkBar(page).getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog
    .getByRole("button", { name: "Clear description", exact: true })
    .click()
  await expect(
    dialog.getByText("The description will be cleared.", { exact: true })
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Apply changes" }).click()

  await expect(
    page.getByText("Roles updated: 1", { exact: true })
  ).toBeVisible()

  const row = page.getByRole("row").filter({ hasText: "Demo Role 31" })
  await expect(row).toContainText("Demo Role 31")
  await expect(row).not.toContainText("Description for demo role 31")
})

test("bulk delete asks for confirmation and removes the selected roles", async ({
  page,
}) => {
  await loginAsAdmin(page)

  await rowCheckbox(page, "Demo Role 31").click()
  await rowCheckbox(page, "Demo Role 32").click()
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible()

  await bulkBar(page)
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole("heading", { name: "Delete 2 roles?" })
  ).toBeVisible()

  await dialog.getByRole("button", { name: "Delete roles" }).click()

  await expect(
    page.getByText("Roles deleted: 2", { exact: true })
  ).toBeVisible()
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Demo Role 31" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Demo Role 32" })
  ).toHaveCount(0)
  // The page refills from the next page, and the total drops by two.
  await expect(page.locator("tbody tr")).toHaveCount(30)
  await expect(page.getByText("58 roles", { exact: true })).toBeVisible()
})

test("bulk edit reports per-row failures while successful rows update", async ({
  page,
}) => {
  await loginAsAdmin(page)

  // A System Role cannot be set inactive; a demo Role can.
  await rowCheckbox(page, "Administrator").click()
  await rowCheckbox(page, "Demo Role 33").click()

  await bulkBar(page).getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Status", { exact: true }).click()
  await page.getByRole("option", { name: "Inactive", exact: true }).click()
  await dialog.getByRole("button", { name: "Apply changes" }).click()

  await expect(
    page.getByText("Roles updated: 1 · failed: 1", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("Administrator: system role", { exact: true })
  ).toBeVisible()
  await expect(bulkBar(page)).toHaveCount(0)

  const adminRow = page.getByRole("row").filter({ hasText: "Administrator" })
  const demoRow = page.getByRole("row").filter({ hasText: "Demo Role 33" })
  await expect(adminRow.getByText("active", { exact: true })).toBeVisible()
  await expect(demoRow.getByText("inactive", { exact: true })).toBeVisible()
})

test("bulk delete reports per-row failures while successful rows are removed", async ({
  page,
}) => {
  await loginAsAdmin(page)

  await rowCheckbox(page, "Administrator").click()
  await rowCheckbox(page, "Demo Role 33").click()
  await bulkBar(page)
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Delete roles" }).click()

  await expect(
    page.getByText("Roles deleted: 1 · failed: 1", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("Administrator: system role", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: "Demo Role 33" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Administrator" })
  ).toHaveCount(1)
  await expect(page.getByText("59 roles", { exact: true })).toBeVisible()
})

test("selection clears whenever filters, sort, or page size change", async ({
  page,
}) => {
  await loginAsAdmin(page)

  // A filter change clears the selection.
  await rowCheckbox(page, "Demo Role 31").click()
  await expect(bulkBar(page)).toBeVisible()
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(
    "demo role 31"
  )
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { checked: true })
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Clear all" }).click()
  await expect(page.getByRole("table")).toBeVisible()

  // A sort change clears the selection.
  await rowCheckbox(page, "Demo Role 31").click()
  await expect(bulkBar(page)).toBeVisible()
  await page.getByRole("button", { name: "Title", exact: true }).click()
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { checked: true })
  ).toHaveCount(0)

  // A page-size change clears the selection.
  await rowCheckbox(page, "Administrator").click()
  await expect(bulkBar(page)).toBeVisible()
  await page.getByLabel("Rows per page").click()
  await page.getByRole("option", { name: "10", exact: true }).click()
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { checked: true })
  ).toHaveCount(0)
})

test("members see no selection checkboxes or bulk controls", async ({
  page,
}) => {
  await login(page, "member@example.com", "memberpass")
  await openRoles(page)

  await expect(page.getByRole("table")).toBeVisible()
  await expect(page.getByRole("checkbox")).toHaveCount(0)
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Edit", exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Delete", exact: true })
  ).toHaveCount(0)
})

test("bulk actions emit counts-only role.bulk_action events", async ({
  page,
}) => {
  const messages: ConsoleMessage[] = []
  page.on("console", (message) => messages.push(message))

  await loginAsAdmin(page)

  await rowCheckbox(page, "Demo Role 34").click()
  await rowCheckbox(page, "Demo Role 35").click()
  await bulkBar(page).getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Status", { exact: true }).click()
  await page.getByRole("option", { name: "Active", exact: true }).click()
  await dialog.getByRole("button", { name: "Apply changes" }).click()
  await expect(
    page.getByText("Roles updated: 2", { exact: true })
  ).toBeVisible()

  await expect
    .poll(async () => (await findEvent(messages, "role.bulk_action"))?.data)
    .toEqual({
      action: "update",
      selected: 2,
      updated: 2,
      failed: 0,
    })
  const updateEntry = await findEvent(messages, "role.bulk_action")
  expect(JSON.stringify(updateEntry)).not.toContain("Demo Role")

  await rowCheckbox(page, "Demo Role 34").click()
  await rowCheckbox(page, "Demo Role 35").click()
  await bulkBar(page)
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete roles" })
    .click()
  await expect(
    page.getByText("Roles deleted: 2", { exact: true })
  ).toBeVisible()

  await expect
    .poll(async () => {
      const entries = []
      for (const message of messages) {
        const value = await message
          .args()[0]
          ?.jsonValue()
          .catch(() => undefined)
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          (value as ConsoleEntry).kind === "event" &&
          (value as ConsoleEntry).event === "role.bulk_action"
        ) {
          entries.push((value as ConsoleEntry).data)
        }
      }
      return entries.find((entry) => entry?.action === "delete")
    })
    .toEqual({
      action: "delete",
      selected: 2,
      deleted: 2,
      failed: 0,
    })
})
