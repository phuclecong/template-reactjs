import { expect, type Page } from "@playwright/test"

/** Render an ISO instant the way the Roles screen does: local `YYYY-MM-DD HH:mm`. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Resolves once a full document load at `pathname` finishes.
 *
 * Auth success handlers navigate twice: Refine redirects on the client, then
 * the form hard-navigates so the session boots from sessionStorage. Only the
 * second navigation replaces the document. Start this wait before the click
 * that triggers the redirect; reloading or typing while that navigation is
 * still in flight aborts it (`net::ERR_ABORTED`) or discards the input.
 */
export function waitForDocumentLoad(page: Page, pathname: RegExp) {
  return page.waitForEvent("load", () =>
    pathname.test(new URL(page.url()).pathname)
  )
}

/** Sign in and wait until the dashboard document has loaded. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  const dashboardLoaded = waitForDocumentLoad(page, /^\/dashboard$/)
  await page.getByRole("button", { name: "Sign in" }).click()
  await dashboardLoaded
  await expect(page).toHaveURL(/\/dashboard$/)
}
