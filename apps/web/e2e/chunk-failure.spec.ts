import { expect, test, type Page } from "@playwright/test"

/**
 * Simulated chunk failure. The test intercepts the module request the Vite dev
 * server would serve for a route and answers 404, then checks the user-visible
 * recovery surface. It does not assert chunk filenames or the production chunk
 * graph.
 *
 * The lazy helper reloads the document once after repeated failure. This test
 * seeds its session marker so the failure lands directly on the boundary (the
 * unit tests cover the reload itself), keeping the assertions deterministic.
 * Overlays share the same `RetryableLazy` boundary, covered by the unit tests
 * in `test/chunk-error-boundary.test.tsx`.
 */
const RELOAD_MARKER = "chunk-reload-attempted"

const SESSION = JSON.stringify({
  token: "e2e-chunk-failure-token",
  user: {
    id: "usr_admin",
    name: "Ada Admin",
    email: "admin@example.com",
    role: "admin",
  },
})

const SETTINGS_ROUTE_MODULE = /\/src\/routes\/settings\.tsx/

async function seedSession(page: Page) {
  await page.addInitScript(
    ({ session, marker }) => {
      sessionStorage.setItem("auth.session", session)
      sessionStorage.setItem(marker, "1")
    },
    { session: SESSION, marker: RELOAD_MARKER }
  )
}

test("a failed route chunk shows a retry action and never a blank route", async ({
  page,
}) => {
  await seedSession(page)
  await page.route(SETTINGS_ROUTE_MODULE, (route) =>
    route.fulfill({ status: 404, body: "missing chunk" })
  )

  await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded" })

  const retry = page.getByRole("button", { name: "Try again" })
  await expect(retry).toBeVisible()
  await expect(page.getByRole("alert")).toContainText("Something went wrong")

  // The authenticated shell is still there; the route is not blank.
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" })
  ).toBeVisible()
  await expect(page.locator("#root")).not.toBeEmpty()

  // Recoverable, not a dead end: stop failing the import and retry.
  await page.unroute(SETTINGS_ROUTE_MODULE)
  await retry.click()

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
})
