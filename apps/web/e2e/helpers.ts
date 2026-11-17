import { expect, type Page } from "@playwright/test"

/** Render an ISO instant the way the Roles screen does: local `YYYY-MM-DD HH:mm`. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Sign in and wait until the dashboard shell loads. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}
