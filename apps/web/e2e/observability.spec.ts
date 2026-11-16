import { expect, test, type ConsoleMessage, type Page } from "@playwright/test"

import { login } from "./helpers"

type ConsoleEntry = {
  kind?: string
  event?: string
  level?: string
  context?: { path?: string; env?: string }
  data?: Record<string, unknown>
}

async function openTasks(page: Page) {
  await page
    .locator('[data-sidebar="menu-button"]', { hasText: "Tasks" })
    .click()
  await expect(page).toHaveURL(/\/dashboard\/tasks/)
  await expect(page.getByRole("table")).toBeVisible()
}

async function findEntry(
  messages: ConsoleMessage[],
  kind: string
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
      (value as ConsoleEntry).kind === kind
    ) {
      return value as ConsoleEntry
    }
  }

  return undefined
}

test("a task mutation emits a structured business event", async ({ page }) => {
  const messages: ConsoleMessage[] = []
  page.on("console", (message) => messages.push(message))

  await login(page, "admin@example.com", "adminpass")
  await openTasks(page)

  await page.getByRole("button", { name: "New task" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Title").fill("E2E observability task")
  await dialog.getByRole("button", { name: "Create task" }).click()
  await expect(page.getByText("Task created")).toBeVisible()

  await expect
    .poll(async () => (await findEntry(messages, "event"))?.event)
    .toBe("task.created")

  const entry = await findEntry(messages, "event")
  expect(entry).toMatchObject({
    kind: "event",
    level: "info",
    event: "task.created",
    context: { path: "/dashboard/tasks", env: "development" },
  })
  expect(entry?.data).toHaveProperty("taskId")
  // Business events carry ids, never the task title or other free text.
  expect(JSON.stringify(entry)).not.toContain("E2E observability task")
})
