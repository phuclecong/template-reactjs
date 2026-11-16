import type { RoutePath } from "./route-paths"

/**
 * Page metadata for one route. The table below is typed as
 * `Record<RoutePath, RouteMetadata>`, so adding a route to `routeLoaders`
 * without metadata — or metadata for something that is not a route — fails
 * `tsc`. Keep this module pure TypeScript: both the build (Node) and the
 * client import it.
 */
export type RouteMetadata = {
  /** Page title before the site title template is applied. */
  title: string
  /** Page description, also used as the social-preview description. */
  description: string
  /** Whether the route may appear in search results. */
  indexable: boolean
}

export const SITE_NAME = "Dashboard"
export const SITE_DESCRIPTION =
  "A reusable dashboard for managing tasks, users, and settings."
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`

/**
 * Origin used when `SITE_URL` is unset, so local builds and `vite preview`
 * still emit absolute URLs. A live host must set `SITE_URL`.
 */
export const DEFAULT_SITE_URL = "http://localhost:4173"

export const routeMetadata: Record<RoutePath, RouteMetadata> = {
  "/login": {
    title: "Sign in",
    description:
      "Sign in to the dashboard to manage your tasks, users, and settings.",
    indexable: true,
  },
  "/register": {
    title: "Create an account",
    description:
      "Create an account to start managing tasks, users, and settings.",
    indexable: true,
  },
  "/dashboard/tasks": {
    title: "Tasks",
    description: "View and manage tasks in the dashboard.",
    indexable: false,
  },
  "/dashboard/users": {
    title: "Users",
    description: "View and manage users and roles in the dashboard.",
    indexable: false,
  },
  "/dashboard/settings": {
    title: "Settings",
    description: "Manage account and application settings.",
    indexable: false,
  },
}

export function pageTitle(title: string): string {
  return TITLE_TEMPLATE.replace("%s", title)
}

/** Normalizes a build-time canonical origin to a bare absolute origin. */
export function resolveSiteUrl(siteUrl: string | undefined): string {
  const trimmed = siteUrl?.trim()
  if (!trimmed) return DEFAULT_SITE_URL
  return trimmed.replace(/\/+$/, "")
}

/** Absolute canonical URL for a route; the same string is used for og:url. */
export function canonicalUrl(path: RoutePath | "/", siteUrl: string): string {
  return `${resolveSiteUrl(siteUrl)}${path}`
}
