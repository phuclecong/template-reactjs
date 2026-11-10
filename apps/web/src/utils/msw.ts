import { setupWorker } from "msw/browser"
import { dataHandlers } from "@workspace/api/data-handlers"
import { seedDb, tasks, users } from "@workspace/api/collections"

/**
 * Boots the in-browser MSW worker that serves the mock API for client-side
 * data fetching (ADR-0001, ADR-0005). Seeded once; repeated calls return the
 * same promise so StrictMode double-effects don't re-register the worker.
 */
let workerPromise: Promise<void> | null = null

/**
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

export function startMockWorker(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!workerPromise) {
    workerPromise = (async () => {
      await seedOnce()
      const worker = setupWorker(...dataHandlers)
      await worker.start({ onUnhandledFrame: "bypass" })
    })()
  }
  return workerPromise
}
