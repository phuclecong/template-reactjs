import { expect, test } from "@playwright/test"

import { login } from "./helpers"

test("legacy /dashboard/tasks redirects to /tasks and shows the table", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  await page.goto("/dashboard/tasks")

  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole("table")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toContainText("Tasks")
})

test("legacy /dashboard/users redirects to /users and shows the users table", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  await page.goto("/dashboard/users")

  await expect(page).toHaveURL(/\/users$/)
  await expect(page.getByRole("textbox", { name: "Search users" })).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
})

test("legacy /dashboard/settings redirects to /settings and shows Settings", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  await page.goto("/dashboard/settings")

  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
})

test("/dashboard is the placeholder home with the shell, heading, and no table", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await expect(page).toHaveURL(/\/dashboard$/)

  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" })
  await expect(breadcrumb).toContainText("Dashboard")
  await expect(
    breadcrumb.getByRole("link", { name: "Dashboard" })
  ).toHaveAttribute("aria-current", "page")

  await expect(
    page.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible()
  await expect(page.getByRole("table")).toHaveCount(0)
})
