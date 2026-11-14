/**
 * Request-time loader for the in-browser MSW worker.
 *
 * The mock backend must stay off the first-paint critical path: `/login` should
 * paint and accept input before any worker, handlers, or seed data exist. Both
 * request transports (the axios data provider and the native `fetch` auth
 * client) call this before sending a request, so the first `/api` request is
 * intercepted rather than silently receiving the SPA HTML fallback.
 *
 * The `VITE_API_URL` check and the dynamic `import()` of the heavy module live
 * in this same module on purpose: Vite can only fold the branch and drop the
 * worker chunk from a real-backend build when the condition is a compile-time
 * `import.meta.env` read here. Passing the mode in as a prop or an imported
 * constant keeps the chunk in the graph.
 *
 * One module-level promise is shared by every caller (StrictMode and concurrent
 * requests included). A failed start clears it so the next request can retry
 * instead of reusing a permanently rejected promise.
 */
let workerPromise: Promise<void> | null = null

export function ensureMockWorker(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!workerPromise) {
    workerPromise = (async () => {
      if (import.meta.env.VITE_API_URL) return
      const { startMockWorker } = await import("@/utils/msw")
      await startMockWorker()
    })().catch((error: unknown) => {
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}
