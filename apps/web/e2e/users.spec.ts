import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

async function openUsers(page: Page) {
  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/users$/)
  // Wait for the Users page itself before asserting on the table, otherwise
  // the Tasks table still mounted during the route transition can match.
  await expect(
    page.getByRole("textbox", { name: "Search users" })
  ).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
}

test("admin assigns a Role by identity and deletes a user", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  // The sidebar footer shows the Role title, not a raw enum.
  await expect(
    page.locator('[data-sidebar="footer"]').getByText("Administrator")
  ).toBeVisible()

  await openUsers(page)

  // Both seeded users render with their Role titles.
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()
  await expect(page.getByLabel("Role for Ada Admin")).toContainText(
    "Administrator"
  )
  await expect(page.getByLabel("Role for Mia Member")).toContainText("Member")

  // Inactive Roles are offered by identity but unavailable for assignment.
  await page.getByLabel("Role for Mia Member").click()
  await expect(
    page.getByRole("option", { name: "Demo Role 02" })
  ).toHaveAttribute("aria-disabled", "true")

  // Promote Mia Member to Administrator; the trigger reflects the new title.
  await page.getByRole("option", { name: "Administrator", exact: true }).click()
  await expect(page.getByText("Role updated")).toBeVisible()
  await expect(page.getByLabel("Role for Mia Member")).toContainText(
    "Administrator"
  )

  // Delete Mia Member.
  const miaRow = page.getByRole("row").filter({ hasText: "Mia Member" })
  await miaRow.getByRole("button", { name: "Delete" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Delete" }).click()

  await expect(page.getByText("User deleted")).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toHaveCount(0)
})

test("filters users by Role identity and clears the filter", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")
  await openUsers(page)

  const roleInput = page.getByRole("combobox", {
    name: "Role",
    exact: true,
  })
  await expect(roleInput).toHaveAttribute("placeholder", "Role")

  await roleInput.click()
  await roleInput.fill("mem")
  await expect(page.getByRole("option", { name: "Member" })).toBeVisible()
  await expect(page.getByRole("option", { name: "Administrator" })).toHaveCount(
    0
  )
  await page.getByRole("option", { name: "Member" }).click()

  await expect(page).toHaveURL(/roleId=rol_member/)
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toHaveCount(0)

  // The clear control is internal to the combobox and icon-only, so target its
  // data-slot contract rather than an accessible name.
  await page.locator('[data-slot="combobox-clear"]').click()

  await expect(page).not.toHaveURL(/roleId=/)
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()
})

test("filters users by an inactive Role identity", async ({ page }) => {
  await login(page, "admin@example.com", "adminpass")
  await openUsers(page)

  const roleInput = page.getByRole("combobox", {
    name: "Role",
    exact: true,
  })
  await roleInput.click()
  await roleInput.fill("Demo Role 02")
  await page.getByRole("option", { name: "Demo Role 02" }).click()

  await expect(page).toHaveURL(/roleId=rol_demo_02/)
  await expect(
    page.getByText("No users match your search or filters.")
  ).toBeVisible()
})

test("member sees the users list read-only with Role titles", async ({
  page,
}) => {
  await login(page, "member@example.com", "memberpass")
  await openUsers(page)

  // The list renders for a member, including the Role titles…
  await expect(page.getByRole("cell", { name: "Ada Admin" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Mia Member" })).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Administrator", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Member", exact: true })
  ).toBeVisible()

  // …but role changes and deletes are hidden.
  await expect(page.getByLabel("Role for Mia Member")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0)
})
