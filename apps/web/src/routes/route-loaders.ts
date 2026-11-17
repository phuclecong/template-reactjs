import type { ComponentType } from "react"

type RouteModule = { default: ComponentType }

/**
 * Shared map from URL path to the route's dynamic import. It is the single
 * source of truth for both `React.lazy` in `App` and intent prefetching, so a
 * hovered link warms the exact module the route will render.
 *
 * Route modules export named components; the adapters give `React.lazy` the
 * default export it expects. Nothing here is invoked at module load, so no
 * route chunk is requested at startup or while idle.
 */
export const routeLoaders = {
  "/login": () =>
    import("@/routes/login").then((module) => ({
      default: module.LoginPage,
    })),
  "/register": () =>
    import("@/routes/register").then((module) => ({
      default: module.RegisterPage,
    })),
  "/dashboard": () =>
    import("@/routes/dashboard").then((module) => ({
      default: module.DashboardPage,
    })),
  "/tasks": () =>
    import("@/routes/tasks").then((module) => ({
      default: module.TasksPage,
    })),
  "/users": () =>
    import("@/routes/users").then((module) => ({
      default: module.UsersPage,
    })),
  "/roles": () =>
    import("@/routes/roles").then((module) => ({
      default: module.RolesPage,
    })),
  "/settings": () =>
    import("@/routes/settings").then((module) => ({
      default: module.SettingsPage,
    })),
} satisfies Record<string, () => Promise<RouteModule>>

export type RoutePath = keyof typeof routeLoaders

export function isRoutePath(path: string): path is RoutePath {
  return Object.hasOwn(routeLoaders, path)
}

/**
 * Warms a route chunk on user intent. Unknown paths (for example a future
 * route) are ignored, and a failed optimistic import is swallowed: the route
 * render itself owns the real failure surface.
 */
export function prefetchRoute(path: string): Promise<unknown> {
  if (!isRoutePath(path)) return Promise.resolve()
  return routeLoaders[path]().catch(() => undefined)
}
