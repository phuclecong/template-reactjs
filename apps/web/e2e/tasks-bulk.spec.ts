import {
  expect,
  test,
  type ConsoleMessage,
  type Page,
} from "@playwright/test"

import { login, rowByText, scrollRowIntoView } from "./helpers"

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

async function openTasks(page: Page) {
  await page
    .locator('[data-sidebar="menu-button"]', { hasText: "Tasks" })
    .click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole("table")).toBeVisible()
}

async function loginAsAdmin(page: Page) {
  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)
}

function bulkBar(page: Page) {
  return page.getByRole("region", { name: "Bulk actions" })
}

function rowCheckbox(page: Page, title: string) {
  return page.getByRole("checkbox", { name: `Select ${title}` })
}

test("the bulk bar appears with a selection and clears on page change", async ({
  page,
}) => {
  await loginAsAdmin(page)

  await expect(bulkBar(page)).toHaveCount(0)

  // The default title sort places this row below the first viewport once the
  // body virtualizes, so mount it before interacting.
  await scrollRowIntoView(page, rowByText(page, "Build the MSW mock"))
  await rowCheckbox(page, "Build the MSW mock").click()
  await expect(bulkBar(page)).toBeVisible()
  await expect(
    bulkBar(page).getByText("1 selected", { exact: true })
  ).toBeVisible()

  // Changing page clears the selection and hides the bar.
  await page.getByRole("button", { name: "Page 2" }).click()
  await expect(page).toHaveURL(/[?&]page=2\b/)
  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { checked: true })
  ).toHaveCount(0)
})

test("bulk edit applies several dirty fields in one update", async ({
  page,
}) => {
  await loginAsAdmin(page)

  await scrollRowIntoView(page, rowByText(page, "Build the MSW mock"))
  await rowCheckbox(page, "Build the MSW mock").click()
  await scrollRowIntoView(page, rowByText(page, "Audit the access-control matrix #17"))
  await rowCheckbox(page, "Audit the access-control matrix #17").click()
  await expect(
    bulkBar(page).getByText("2 selected", { exact: true })
  ).toBeVisible()

  await bulkBar(page).getByRole("button", { name: "Edit", exact: true }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole("heading", { name: "Edit 2 tasks" })
  ).toBeVisible()

  await sheet.getByLabel("Status", { exact: true }).click()
  await page.getByRole("option", { name: "Done", exact: true }).click()
  await sheet.getByLabel("Priority", { exact: true }).click()
  await page.getByRole("option", { name: "High", exact: true }).click()
  await sheet.getByRole("button", { name: "Apply changes" }).click()

  await expect(page.getByText("Updated 2 tasks", { exact: true })).toBeVisible()
  await expect(bulkBar(page)).toHaveCount(0)

  const first = await scrollRowIntoView(
    page,
    rowByText(page, "Build the MSW mock")
  )
  const second = await scrollRowIntoView(
    page,
    rowByText(page, "Audit the access-control matrix #17")
  )
  await expect(first.getByText("Done", { exact: true })).toBeVisible()
  await expect(first.getByText("High", { exact: true })).toBeVisible()
  await expect(second.getByText("Done", { exact: true })).toBeVisible()
  await expect(second.getByText("High", { exact: true })).toBeVisible()
})

test("bulk edit emits an update event naming the changed fields", async ({
  page,
}) => {
  const messages: ConsoleMessage[] = []
  page.on("console", (message) => messages.push(message))

  await loginAsAdmin(page)

  await scrollRowIntoView(page, rowByText(page, "Build the MSW mock"))
  await rowCheckbox(page, "Build the MSW mock").click()
  await bulkBar(page).getByRole("button", { name: "Edit", exact: true }).click()
  const sheet = page.getByRole("dialog")
  await sheet.getByLabel("Status", { exact: true }).click()
  await page.getByRole("option", { name: "Done", exact: true }).click()
  await sheet.getByRole("button", { name: "Apply changes" }).click()

  await expect(page.getByText("Updated 1 tasks", { exact: true })).toBeVisible()

  await expect
    .poll(async () => (await findEvent(messages, "task.bulk_action"))?.data)
    .toEqual({
      action: "update",
      fields: ["status"],
      selected: 1,
      updated: 1,
      failed: 0,
    })
})

test("a filter change clears the selection", async ({ page }) => {
  await loginAsAdmin(page)

  await scrollRowIntoView(page, rowByText(page, "Build the MSW mock"))
  await rowCheckbox(page, "Build the MSW mock").click()
  await expect(bulkBar(page)).toBeVisible()

  await page.getByLabel("Search tasks").fill("release")

  await expect(bulkBar(page)).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { checked: true })
  ).toHaveCount(0)
})
