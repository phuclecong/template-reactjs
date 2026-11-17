import { expect, test } from "@playwright/test"

import { login } from "./helpers"

const SETTINGS_ROUTE_MODULE = /\/src\/routes\/settings\.tsx/
const USERS_ROUTE_MODULE = /\/src\/routes\/users\.tsx/
const REGISTER_ROUTE_MODULE = /\/src\/routes\/register\.tsx/

const SESSION = JSON.stringify({
  token: "e2e-loading-token",
  user: {
    id: "usr_admin",
    name: "Ada Admin",
    email: "admin@example.com",
    role: "admin",
  },
})

test("route chunks load on intent only, never at startup or while idle", async ({
  page,
}) => {
  const routeModuleRequests: string[] = []
  page.on("request", (request) => {
    const url = request.url()
    if (/\/src\/routes\/[a-z]+\.tsx/.test(url)) routeModuleRequests.push(url)
  })

  await page.goto("/login")
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()

  // The auth screen loads only its own route; register is never fetched.
  expect(routeModuleRequests.some((url) => REGISTER_ROUTE_MODULE.test(url))).toBe(
    false
  )

  await login(page, "admin@example.com", "adminpass")
  // Login lands on the /dashboard placeholder, so navigate to Tasks explicitly.
  await page.locator('[data-sidebar="menu-button"]', { hasText: "Tasks" }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole("table")).toBeVisible()

  // Settling on Tasks does not warm Users or Settings.
  await page.waitForTimeout(1000)
  expect(routeModuleRequests.some((url) => USERS_ROUTE_MODULE.test(url))).toBe(
    false
  )
  expect(
    routeModuleRequests.some((url) => SETTINGS_ROUTE_MODULE.test(url))
  ).toBe(false)

  // Hovering the Settings link is the intent signal that warms its chunk.
  await page.getByRole("link", { name: "Settings" }).hover()
  await expect
    .poll(() => routeModuleRequests.some((url) => SETTINGS_ROUTE_MODULE.test(url)))
    .toBe(true)

  await page.getByRole("link", { name: "Settings" }).click()
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
})

test("a cold route load shows the page skeleton, never a blank shell", async ({
  page,
}) => {
  // Seed the session before the app modules read sessionStorage.
  await page.addInitScript((session) => {
    sessionStorage.setItem("auth.session", session)
  }, SESSION)

  // Hold the route chunk so the Suspense fallback has time to paint.
  await page.route(SETTINGS_ROUTE_MODULE, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })

  await page.goto("/settings", { waitUntil: "domcontentloaded" })

  // The shell frame and a translated loading status are visible while the
  // chunk is in flight. The skeleton exposes no table semantics of its own.
  await expect(page.getByRole("status").first()).toBeVisible()
  await expect(page.getByRole("status").first()).toHaveText("Loading…")
  await expect(page.getByRole("table")).toHaveCount(0)

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
})
