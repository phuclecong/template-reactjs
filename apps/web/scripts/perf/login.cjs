"use strict"

/**
 * LHCI `collect.puppeteerScript` session seed.
 *
 * The audited tab must start **cold**: no service worker registration and no
 * persisted mock data. Logging in through the UI would violate that contract —
 * it starts the MSW worker, which then answers the audited tab's subresource
 * requests and makes Lighthouse report dynamic route chunks as header-only
 * transfers (`transferSize: 179`). It would also start the first visit with a
 * warm `/api` cache, contrary to the measurement contract (§5).
 *
 * Instead, inject the deterministic mock session into the audited page target
 * before any app module runs. `/dashboard/*` is then authenticated, while the
 * mock worker and the 150-task seed still start on the first `/api` request
 * inside the audit — the cold first visit the spec measures.
 *
 * The mock token is the same `mock.<base64url(claims)>` string
 * `packages/api/src/auth.ts` signs, and the user matches `ensureSeedUsers`.
 * LHCI audits in a page target it creates after this script runs, so every
 * page target created afterwards is seeded via `evaluateOnNewDocument`.
 * `settings.disableStorageReset: true` in lighthouserc.cjs keeps the injected
 * sessionStorage for the audit. localStorage is deliberately left empty.
 */

const DASHBOARD_PREFIX = "/dashboard"
const SESSION_KEY = "auth.session"

// These literals intentionally duplicate the TypeScript seed
// (`packages/api/src/auth.ts` / `ensureSeedUsers`) so this one-shot Puppeteer
// script can run outside the app bundle. `apps/web/test/perf-login.test.ts`
// pins them against `signToken` and the seeded user, so drift fails CI.
const TOKEN_CLAIMS = { sub: "usr_admin", role: "admin", type: "access" }
const SEEDED_ADMIN = {
  id: "usr_admin",
  name: "Ada Admin",
  email: "admin@example.com",
  role: "admin",
}

function base64UrlEncode(input) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** The exact `auth.session` value the auth provider persists on login. */
function buildSession() {
  const token = `mock.${base64UrlEncode(JSON.stringify(TOKEN_CLAIMS))}`
  return JSON.stringify({ token, user: SEEDED_ADMIN })
}

/** Sets sessionStorage before the page's own scripts execute. */
function injectSession(page, session) {
  return page.evaluateOnNewDocument(
    (key, value) => {
      sessionStorage.setItem(key, value)
    },
    SESSION_KEY,
    session
  )
}

/** @param {import('puppeteer').Browser} browser @param {{url: string}} context */
module.exports = async function login(browser, context) {
  const route = new URL(context.url).pathname

  // `/login` is the unauthenticated entry route; it must stay anonymous and
  // must not have a session or worker of any kind.
  if (!route.startsWith(DASHBOARD_PREFIX)) return

  const session = buildSession()
  const seed = (page) =>
    injectSession(page, session).catch(() => {
      // A target that closes before setup cannot be audited anyway.
    })

  // Lighthouse creates a new page target for the audit; seed it the moment it
  // appears, before that tab navigates.
  browser.on("targetcreated", (target) => {
    if (target.type() !== "page") return
    target
      .page()
      .then((targetPage) => (targetPage ? seed(targetPage) : undefined))
      .catch(() => {
        // Ignore targets that disappear during setup.
      })
  })

  // Seed any page that already exists (for example a reused blank target).
  for (const page of await browser.pages()) await seed(page)

  process.stdout.write(`Seeded mock admin session for ${context.url}\n`)
}

module.exports.buildSession = buildSession
module.exports.injectSession = injectSession
