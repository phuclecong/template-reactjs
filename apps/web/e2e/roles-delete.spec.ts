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

/** The list is server-filtered; narrow it before asserting on one row. */
async function filterByTitle(page: Page, title: string) {
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  const row = page.getByRole("row").filter({ hasText: title })
  await expect(row).toBeVisible()
  return row
}

test("admin deletes a role after confirming its title, refreshes, and emits role.deleted", async ({
  page,
}) => {
  const messages: ConsoleMessage[] = []
  page.on("console", (message) => messages.push(message))

  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  const row = await filterByTitle(page, "Demo Role 07")
  await row.getByRole("button", { name: "Delete" }).click()

  // The confirmation names the Role being deleted.
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("Delete role?")
  await expect(dialog).toContainText("Demo Role 07")
  await expect(dialog).toContainText("cannot be undone")

  const deleteRequest = page.waitForRequest(
    (request) =>
      request.method() === "DELETE" &&
      new URL(request.url()).pathname.endsWith("/api/roles/rol_demo_07")
  )
  await dialog.getByRole("button", { name: "Delete" }).click()
  await deleteRequest

  // Success feedback and a refreshed list without the deleted row.
  await expect(page.getByText("Role deleted")).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Demo Role 07" })
  ).toHaveCount(0)

  // The event carries only the Role id, never the Role title.
  await expect
    .poll(async () => (await findEvent(messages, "role.deleted"))?.data)
    .toEqual({ roleId: "rol_demo_07" })
  const entry = await findEvent(messages, "role.deleted")
  expect(JSON.stringify(entry)).not.toContain("Demo Role 07")
})

test("a role held by a user cannot be deleted: clear error, row remains", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  // Give Mia Member an active demo Role so the server rejects deleting it.
  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/users$/)
  await expect(page.getByRole("table")).toBeVisible()
  await page.getByLabel("Role for Mia Member").click()
  await page.getByRole("option", { name: "Demo Role 57", exact: true }).click()
  await expect(page.getByText("Role updated")).toBeVisible()

  await openRoles(page)
  const row = await filterByTitle(page, "Demo Role 57")
  await row.getByRole("button", { name: "Delete" }).click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Delete" }).click()

  // The 409 is surfaced and the referenced Role stays in the table.
  await expect(page.getByText("Could not delete the role.")).toBeVisible()
  await expect(
    page.getByText("This role is assigned to a user and cannot be deleted.")
  ).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Demo Role 57" })
  ).toBeVisible()
})

test("System Roles keep Edit but hide Delete; demo roles offer it", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  for (const title of ["Administrator", "Member"]) {
    const row = page.getByRole("row").filter({ hasText: title }).first()
    await expect(row.getByText(title, { exact: true })).toBeVisible()
    await expect(row.getByRole("button", { name: "Edit" })).toBeVisible()
    await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0)
  }

  // Demo Roles are deletable from the same actions column.
  const demoRow = page.getByRole("row").filter({ hasText: "Demo Role 58" })
  await expect(demoRow.getByRole("button", { name: "Edit" })).toBeVisible()
  await expect(demoRow.getByRole("button", { name: "Delete" })).toBeVisible()
})
