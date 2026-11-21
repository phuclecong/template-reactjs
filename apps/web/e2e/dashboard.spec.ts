import { expect, test } from "@playwright/test"

import { login } from "./helpers"

test("dashboard refreshes its Task summary from a Live event", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()

  const totalKpi = page.getByTestId("dashboard-kpi-total")
  const openKpi = page.getByTestId("dashboard-kpi-open")
  await expect(totalKpi).toBeVisible()
  await expect(openKpi).toBeVisible()

  const totalBefore = Number(await totalKpi.textContent())
  const openBefore = Number(await openKpi.textContent())

  // The stream is open once the pill leaves Connecting….
  await expect(page.getByRole("status")).toHaveText("Live")

  const token = await page.evaluate(() => {
    const raw = sessionStorage.getItem("auth.session")
    return raw ? (JSON.parse(raw) as { token: string }).token : null
  })
  expect(token).toBeTruthy()

  // Mutate through the app's own API from the same tab. The mock publishes the
  // event over the open SSE stream, and the Dashboard refetches its summary.
  const status = await page.evaluate(async (accessToken) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: "Live dashboard probe",
        status: "todo",
      }),
    })
    return response.status
  }, token)
  expect(status).toBe(201)

  await expect(totalKpi).toHaveText(String(totalBefore + 1))
  await expect(openKpi).toHaveText(String(openBefore + 1))
})

test("dashboard chart exposes an accessible text alternative", async ({
  page,
}) => {
  await login(page, "admin@example.com", "adminpass")

  await expect(page.getByRole("status")).toHaveText("Live")

  const statusTable = page.getByRole("table", {
    name: "Tasks by status",
  })
  await expect(statusTable).toBeAttached()
  await expect(statusTable.getByRole("row", { name: /To do/ })).toHaveText(
    /To do\s*\d+/
  )

  await expect(
    page.locator("[data-chart] .recharts-bar-rectangle").first()
  ).toBeVisible()
})
