import { expect, test } from "@playwright/test"

import { login } from "./helpers"

test("sidebar navigates between sections", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole("link", { name: "Tasks" }).click()
  await expect(page).toHaveURL(/\/tasks$/)

  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/users$/)

  await page.getByRole("link", { name: "Settings" }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test("sidebar highlights the active page", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole("link", { name: "Tasks" }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.locator("[data-active]").first()).toContainText("Tasks")

  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/users$/)
  await expect(page.locator("[data-active]").first()).toContainText("Users")
})

test("breadcrumb shows the shell root and the current page", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")

  await page.getByRole("link", { name: "Tasks" }).click()
  await expect(page).toHaveURL(/\/tasks$/)

  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" })
  await expect(breadcrumb).toContainText("Dashboard")
  await expect(breadcrumb).toContainText("Tasks")
  await expect(
    breadcrumb.getByRole("link", { name: "Tasks" })
  ).toHaveAttribute("aria-current", "page")
})

test("sidebar collapses to an icon rail and persists across reload", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  const sidebar = page.locator('[data-slot="sidebar"]')
  await expect(sidebar).toHaveAttribute("data-state", "expanded")

  await page.locator('[data-sidebar="trigger"]').click()
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")

  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
    "data-state",
    "collapsed"
  )
})

test("sidebar opens as a drawer on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, "admin@example.com", "adminpass")

  await page.locator('[data-sidebar="trigger"]').click()
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()
})

test("mobile drawer closes after navigating", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, "admin@example.com", "adminpass")

  await page.locator('[data-sidebar="trigger"]').click()
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()

  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/users$/)
  await expect(page.locator('[data-mobile="true"]')).not.toBeVisible()
})

test("signs out via the sidebar footer", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.locator('[data-sidebar="footer"]').getByRole("button").click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login/)
})
