/**
 * Resolved API base URL. With `VITE_API_URL` set this is the real backend
 * origin (which already includes the `/api` prefix); otherwise it is the
 * relative `/api` path served by the in-browser MSW worker.
 */
export const apiUrl = import.meta.env.VITE_API_URL ?? "/api"
