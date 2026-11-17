import { expect, test, type ConsoleMessage, type Page } from "@playwright/test"

import { formatLocalDateTime, login } from "./helpers"

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

test("admin creates a role with inline validation, a toast, and a refreshed list", async ({
  page,
}) => {
  const messages: ConsoleMessage[] = []
  page.on("console", (message) => messages.push(message))

  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await page.getByRole("button", { name: "Create role", exact: true }).click()
  const drawer = page.getByRole("dialog")
  await expect(drawer).toBeVisible()
  await expect(
    drawer.getByRole("heading", { name: "Create role" })
  ).toBeVisible()

  // Title is required; whitespace alone is still blank.
  await drawer.getByRole("button", { name: "Create role" }).click()
  await expect(drawer.getByText("Title is required.")).toBeVisible()

  await drawer.getByLabel("Title").fill("   ")
  await drawer.getByRole("button", { name: "Create role" }).click()
  await expect(drawer.getByText("Title is required.")).toBeVisible()

  // Title is limited to 100 characters after trimming.
  await drawer.getByLabel("Title").fill("x".repeat(101))
  await drawer.getByRole("button", { name: "Create role" }).click()
  await expect(
    drawer.getByText("Title must be at most 100 characters.")
  ).toBeVisible()

  // Description is optional but limited to 500 characters.
  await drawer.getByLabel("Title").fill("Support Engineer")
  await drawer.getByLabel("Description").fill("x".repeat(501))
  await drawer.getByRole("button", { name: "Create role" }).click()
  await expect(
    drawer.getByText("Description must be at most 500 characters.")
  ).toBeVisible()

  await drawer.getByLabel("Description").fill("Handles customer tickets.")
  await expect(drawer.getByLabel("Status")).toHaveValue("Active")
  await drawer.getByRole("button", { name: "Create role" }).click()

  await expect(page.getByText("Role created")).toBeVisible()
  await expect(drawer).toHaveCount(0)

  const createdRow = page
    .getByRole("row")
    .filter({ hasText: "Support Engineer" })
  await expect(createdRow).toBeVisible()
  await expect(createdRow.getByText("active", { exact: true })).toBeVisible()
  await expect(createdRow).toContainText("Handles customer tickets.")

  // The business event carries the Role id and no free text.
  await expect
    .poll(async () => (await findEvent(messages, "role.created"))?.data)
    .toMatchObject({ roleId: expect.any(String) })
  const entry = await findEvent(messages, "role.created")
  expect(entry?.data).toEqual({ roleId: expect.any(String) })
  expect(JSON.stringify(entry)).not.toContain("Support Engineer")
})

test("admin edits a role with prefill and submits only dirty fields", async ({
  page,
}) => {
  const messages: ConsoleMessage[] = []
  page.on("console", (message) => messages.push(message))

  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  const memberRow = page
    .locator("tbody tr")
    .filter({ hasText: "Member" })
    .first()
  await memberRow.getByRole("button", { name: "Edit" }).click()

  const drawer = page.getByRole("dialog")
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole("heading", { name: "Edit role" })).toBeVisible()

  // Prefill comes from the Role detail endpoint.
  await expect(drawer.getByLabel("Title")).toHaveValue("Member")
  await expect(drawer.getByLabel("Description")).toHaveValue(
    "Read-only access to the dashboard."
  )
  await expect(drawer.getByLabel("Status")).toHaveValue("Active")

  await drawer.getByLabel("Description").fill("Read-only catalogue access.")

  // Only the changed field is sent; the title and status are untouched.
  const patchRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.endsWith("/api/roles/rol_member")
  )
  await drawer.getByRole("button", { name: "Save changes" }).click()
  const request = await patchRequest
  expect(request.postDataJSON()).toEqual({
    description: "Read-only catalogue access.",
  })

  await expect(page.getByText("Role updated")).toBeVisible()
  await expect(drawer).toHaveCount(0)

  const renamedRow = page
    .locator("tbody tr")
    .filter({ hasText: "Member" })
    .first()
  await expect(renamedRow).toContainText("Read-only catalogue access.")
  // The original createdAt survives the write.
  await expect(renamedRow).toContainText(
    formatLocalDateTime("2025-12-02T00:00:00.000Z")
  )

  await expect
    .poll(async () => (await findEvent(messages, "role.updated"))?.data)
    .toEqual({ roleId: "rol_member" })
  const entry = await findEvent(messages, "role.updated")
  expect(JSON.stringify(entry)).not.toContain("Read-only catalogue access.")
})

test("a duplicate title renders at form level and keeps entered values", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  await page.getByRole("button", { name: "Create role", exact: true }).click()
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Title").fill("Member")
  await drawer.getByLabel("Description").fill("Temporary description")
  await drawer.getByRole("button", { name: "Create role" }).click()

  await expect(
    drawer.getByRole("alert").filter({
      hasText: "A role with this title already exists.",
    })
  ).toBeVisible()
  await expect(drawer).toBeVisible()
  await expect(drawer.getByLabel("Title")).toHaveValue("Member")
  await expect(drawer.getByLabel("Description")).toHaveValue(
    "Temporary description"
  )
})

test("dirty cancel asks for confirmation while pristine cancel closes", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)

  const createButton = page.getByRole("button", {
    name: "Create role",
    exact: true,
  })
  const drawer = page.getByRole("dialog")

  // Pristine cancel closes immediately.
  await createButton.click()
  await expect(drawer).toBeVisible()
  await drawer.getByRole("button", { name: "Cancel" }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByRole("alertdialog")).toHaveCount(0)

  // Opening create after an edit starts blank, not with the previous record.
  await page
    .locator("tbody tr")
    .filter({ hasText: "Member" })
    .first()
    .getByRole("button", { name: "Edit" })
    .click()
  await expect(drawer.getByLabel("Title")).toHaveValue("Member")
  await drawer.getByRole("button", { name: "Cancel" }).click()
  await expect(drawer).toHaveCount(0)
  await createButton.click()
  await expect(drawer.getByLabel("Title")).toHaveValue("")

  // Dirty cancel asks first; keeping editing preserves the value.
  await createButton.click()
  await drawer.getByLabel("Title").fill("Unsaved role")
  await drawer.getByRole("button", { name: "Cancel" }).click()
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toBeVisible()
  await expect(confirm).toContainText("Discard changes?")
  await confirm.getByRole("button", { name: "Keep editing" }).click()
  await expect(confirm).toHaveCount(0)
  await expect(drawer).toBeVisible()
  await expect(drawer.getByLabel("Title")).toHaveValue("Unsaved role")

  // The drawer's own close control follows the same confirmation path.
  await drawer.getByRole("button", { name: "Close" }).click()
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Keep editing" }).click()
  await expect(drawer).toBeVisible()

  // Discarding closes the drawer without writing.
  await drawer.getByRole("button", { name: "Cancel" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Discard" })
    .click()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByText("Unsaved role")).toHaveCount(0)
})
