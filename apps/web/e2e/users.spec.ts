import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

async function openUsers(page: Page) {
  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/dashboard\/users/)
  // Wait for the Users page itself before asserting on the table, otherwise
  // the Tasks table still mounted during the route transition can match.
  await expect(page.getByRole("textbox", { name: "Search users" })).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
}

test("admin changes a user's role and deletes a user", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openUsers(page)

  // Both seeded users render.
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()

  // Promote Mia Member to admin; the role select reflects the change.
  await page.getByLabel("Role for Mia Member").click()
  await page.getByRole("option", { name: "admin" }).click()
  await expect(page.getByText("Role updated")).toBeVisible()
  await expect(page.getByLabel("Role for Mia Member")).toContainText("admin")

  // Delete Mia Member.
  const miaRow = page.getByRole("row").filter({ hasText: "Mia Member" })
  await miaRow.getByRole("button", { name: "Delete" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Delete" }).click()

  await expect(page.getByText("User deleted")).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toHaveCount(0)
})

test("filters users by role and clears the filter", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openUsers(page)

  const roleInput = page.getByRole("combobox", {
    name: "Role",
    exact: true,
  })
  await expect(roleInput).toHaveAttribute("placeholder", "All")

  await roleInput.click()
  await roleInput.fill("mem")
  await expect(page.getByRole("option", { name: "member" })).toBeVisible()
  await expect(page.getByRole("option", { name: "admin" })).toHaveCount(0)
  await page.getByRole("option", { name: "member" }).click()

  await expect(page).toHaveURL(/role=member/)
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toHaveCount(0)

  await page.getByRole("button", { name: "Clear", exact: true }).click()

  await expect(page).not.toHaveURL(/role=/)
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()
})

test("member sees the users list read-only", async ({ page }) => {
  await login(page, "member@example.com", "memberpass")
  await openUsers(page)

  // The list renders for a member…
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()

  // …but role changes and deletes are hidden.
  await expect(page.getByLabel("Role for Mia Member")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0)
})
