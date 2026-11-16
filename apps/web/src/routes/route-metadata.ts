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
 * Shared social-preview image, checked in under `public/` so link crawlers get
 * one absolute URL for every route. It is metadata only: the page never loads
 * it. Consumers replace this one file in place.
 */
export const OG_IMAGE_PATH = "/og-image.png"
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_ALT =
  "Dashboard: manage your tasks, users, and settings in one place."

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

/** Absolute URL for a path on the given site origin. */
export function absoluteUrl(path: string, siteUrl: string): string {
  return `${siteUrl}${path}`
}

/** Absolute canonical URL for a route; the same string is used for og:url. */
export function canonicalUrl(path: RoutePath | "/", siteUrl: string): string {
  return absoluteUrl(path, siteUrl)
}
