/**
 * Build-only canonical origin resolution.
 *
 * This module is imported only by the build plugin and the crawler-file
 * builders. It must never be reachable from client code: `DEFAULT_SITE_URL`
 * exists for local builds, and a production origin baked into the browser
 * bundle would mislabel preview deployments.
 */

/**
 * Origin used when `SITE_URL` is unset, so local builds and `vite preview`
 * still emit absolute URLs. A live host must set `SITE_URL`.
 */
export const DEFAULT_SITE_URL = "http://localhost:4173"

/** Normalizes a build-time canonical origin to a bare absolute origin. */
export function resolveSiteUrl(siteUrl: string | undefined): string {
  const trimmed = siteUrl?.trim()
  if (!trimmed) return DEFAULT_SITE_URL
  return trimmed.replace(/\/+$/, "")
}
