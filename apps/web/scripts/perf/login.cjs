"use strict"

/**
 * LHCI `collect.puppeteerScript` login step.
 *
 * LHCI launches one browser per `lhci collect` invocation and calls this
 * script immediately before the audited navigation. `pnpm perf` invokes
 * collect once per run, so every run gets a fresh profile and this script
 * logs in from scratch.
 *
 * The auth provider keeps its session in sessionStorage, which is scoped to
 * the tab that logs in. Lighthouse audits a *new* tab, so the login script
 * mirrors the session into every page target created afterwards
 * (`targetcreated` + `evaluateOnNewDocument`) before the app's modules run.
 * `settings.disableStorageReset: true` in lighthouserc.cjs keeps that
 * injected session alive for the audit.
 *
 * The HTTP cache warmed by the login navigation is cleared with CDP so the
 * audited navigation still starts cold.
 */

const DASHBOARD_PREFIX = "/dashboard"
const SESSION_KEY = "auth.session"
const DEFAULT_EMAIL = "admin@example.com"
const DEFAULT_PASSWORD = "adminpass"

function seedSession(session) {
  try {
    sessionStorage.setItem("auth.session", session)
  } catch {
    // Ignore; the audit will fail visibly if the session cannot be seeded.
  }
}

/** @param {import('puppeteer').Browser} browser @param {{url: string}} context */
module.exports = async function login(browser, context) {
  const route = new URL(context.url).pathname

  // `/login` is the unauthenticated entry route; it must stay anonymous.
  if (!route.startsWith(DASHBOARD_PREFIX)) return

  const email = process.env.PERF_LOGIN_EMAIL || DEFAULT_EMAIL
  const password = process.env.PERF_LOGIN_PASSWORD || DEFAULT_PASSWORD
  const loginUrl = new URL("/login", context.url).href

  const page = await browser.newPage()
  let session
  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })

    // The form paints immediately; submitting starts the mock worker lazily.
    await page.locator("input#email").fill(email)
    await page.locator("input#password").fill(password)
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }),
      page.locator('button[type="submit"]').click(),
    ])
    await page.waitForFunction(
      (prefix) => window.location.pathname.startsWith(prefix),
      { timeout: 30_000 },
      DASHBOARD_PREFIX
    )

    session = await page.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY)
    if (!session) throw new Error("Login succeeded but no session was stored")

    // Keep the warm login navigation from leaking into the audited load.
    const client = await page.createCDPSession()
    await client.send("Network.clearBrowserCache")
  } finally {
    await page.close()
  }

  // Lighthouse audits in a fresh tab; seed its sessionStorage before the app
  // boots so `ProtectedRoute` sees the session.
  browser.on("targetcreated", (target) => {
    if (target.type() !== "page") return
    target
      .page()
      .then((targetPage) =>
        targetPage?.evaluateOnNewDocument(seedSession, session)
      )
      .catch(() => {
        // A target that closes before setup cannot be audited anyway.
      })
  })

  process.stdout.write(`Logged in as ${email} for ${context.url}\n`)
}
