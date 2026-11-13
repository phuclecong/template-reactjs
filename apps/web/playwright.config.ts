import { defineConfig, devices } from "@playwright/test"

// Concurrent worktrees each need their own dev server. Default to the usual
// port so CI is unchanged; override with PLAYWRIGHT_PORT for parallel runs.
const port = process.env.PLAYWRIGHT_PORT ?? "5173"
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter web exec vite --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
