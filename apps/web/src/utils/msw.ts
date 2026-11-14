import { setupWorker } from "msw/browser"
import { dataHandlers } from "@workspace/api/data-handlers"
import { seedDb, tasks, users } from "@workspace/api/collections"

/**
 * Boots the in-browser MSW worker that serves the mock API for client-side
 * data fetching (ADR-0001, ADR-0005).
 *
 * This module is reachable only through the dynamic import in
 * `@/utils/mock-worker`: it pulls `msw/browser`, the handlers, and the
 * collections, so it must never be statically imported from the entry path.
 * The caller owns the single shared promise; this function just performs the
 * first start.
 *
 * Seeds the mock store on first visit. The collections hydrate from
 * localStorage via the `persist()` extension on construction, so we only seed
 * when the store is still empty — never clobbering persisted records (e.g. a
 * user registered before a reload).
 */
async function seedOnce(): Promise<void> {
  if (users.all().length === 0 && tasks.all().length === 0) {
    await seedDb()
  }
}

export async function startMockWorker(): Promise<void> {
  if (typeof window === "undefined") return
  await seedOnce()
  const worker = setupWorker(...dataHandlers)
  await worker.start({ onUnhandledFrame: "bypass" })
}
