import { expect, test } from "@playwright/test"

import { waitForDocumentLoad } from "./helpers"

test("register → login → logout", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  const password = "secret123"

  // Register creates the account and lands on the protected shell. The form
  // hard-navigates after Refine's client-side redirect, so wait for that
  // document before reloading; a reload racing it fails with ERR_ABORTED.
  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E User")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  const registered = waitForDocumentLoad(page, /^\/dashboard$/)
  await page.getByRole("button", { name: "Register" }).click()
  await registered
  await expect(page).toHaveURL(/\/dashboard$/)

  // Session survives a reload.
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)

  // Logout ends the session and redirects to login.
  await page.locator('[data-sidebar="footer"]').getByRole("button").click()
  const loggedOut = waitForDocumentLoad(page, /^\/login$/)
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await loggedOut
  await expect(page).toHaveURL(/\/login/)

  // Login with the new credentials.
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  const signedIn = waitForDocumentLoad(page, /^\/dashboard$/)
  await page.getByRole("button", { name: "Sign in" }).click()
  await signedIn
  await expect(page).toHaveURL(/\/dashboard$/)

  // An authenticated visitor on the login page is bounced to the dashboard.
  await page.goto("/login")
  await expect(page).toHaveURL(/\/dashboard$/)
})
