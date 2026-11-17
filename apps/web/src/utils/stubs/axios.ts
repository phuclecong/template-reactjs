/**
 * Browser-build stub for `axios`.
 *
 * `@refinedev/simple-rest` imports axios at module scope to build its default
 * transport, so parallel `import`s keep axios in the bundle even when a custom
 * `httpClient` is always passed. This app always passes the fetch client from
 * `@/utils/http-client`, which implements the same surface, so the default
 * transport is dead weight (~18 kB gzip in every route).
 *
 * The stub only satisfies module evaluation (`create()` plus response
 * interceptors). Its request methods throw, so an accidental fallback to the
 * default transport fails loudly instead of silently bypassing the auth token
 * and mock-worker setup.
 */

function unusedDefaultTransport(): never {
  throw new Error(
    "The axios default transport is not available in browser builds; pass httpClient from @/utils/http-client."
  )
}

const interceptors = { use: () => 0, eject: () => undefined, clear: () => undefined }

const defaultClient = {
  interceptors: { request: interceptors, response: interceptors },
  get: unusedDefaultTransport,
  delete: unusedDefaultTransport,
  post: unusedDefaultTransport,
  put: unusedDefaultTransport,
  patch: unusedDefaultTransport,
  request: unusedDefaultTransport,
}

const axios = {
  create: () => defaultClient,
  ...defaultClient,
}

export default axios
