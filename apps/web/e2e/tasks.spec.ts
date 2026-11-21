import { expect, test } from "@playwright/test"

import { rowByText, scrollRowIntoView } from "./helpers"

test("tasks table loads and searches", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@example.com")
  await page.getByLabel("Password").fill("adminpass")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.locator('[data-sidebar="menu-button"]', { hasText: "Tasks" }).click()
  await expect(page).toHaveURL(/\/tasks$/)

  await expect(page.getByRole("table")).toBeVisible()
  // The default title sort places this task late in the page, beyond the
  // first viewport once the body virtualizes.
  await expect(
    await scrollRowIntoView(page, rowByText(page, "Author the OpenAPI contract"))
  ).toBeVisible()

  await page.getByLabel("Search tasks").fill("release")

  await expect(
    await scrollRowIntoView(page, rowByText(page, /Draft the release notes/))
  ).toBeVisible()
  await expect(page.getByText("Author the OpenAPI contract")).toHaveCount(0)
  await expect(page).toHaveURL(/q=release/)
})
