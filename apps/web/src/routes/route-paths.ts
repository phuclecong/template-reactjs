/**
 * The route union, kept in a DOM/React-free module.
 *
 * `route-loaders.ts` derives its loader map and re-exports `RoutePath`, so app
 * code keeps importing the union from there. The Node-side build plugin also
 * needs the union, and tsconfig.node.json has no JSX/DOM, so importing
 * `route-loaders.ts` from the build would pull route chunks into a project that
 * cannot resolve them. `route-metadata.ts` imports this module instead.
 */
export const routePaths = [
  "/login",
  "/register",
  "/dashboard/tasks",
  "/dashboard/users",
  "/dashboard/settings",
] as const

export type RoutePath = (typeof routePaths)[number]
