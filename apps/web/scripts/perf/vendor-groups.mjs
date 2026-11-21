// Vendor chunk families for the production build, shared by `vite.config.ts`
// and the build-output verifier so the split and its assertions cannot drift.
//
// Every group carries the `$initial` tag: only modules reachable through
// static imports from `index.html` are captured. Route-only vendor code
// (`date-fns`, `react-day-picker`, `@tanstack/react-table`, zod) stays in the
// route/overlay chunks that already defer it. See ADR-0017.

export const INITIAL_TAG = "$initial"

/** Packages that must never enter the initial closure. */
export const FORBIDDEN_IN_INITIAL = [
  "date-fns",
  "react-day-picker",
  "@tanstack/react-table",
  "zod",
]

/**
 * The package directory a resolved module id belongs to, or `null` for
 * first-party and virtual modules.
 *
 * Module ids are absolute paths and, under pnpm, look like
 * `/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js`. The
 * last `node_modules/` segment is the real package directory, so stripping to
 * it makes scoped and unscoped packages compare by name rather than by a
 * prefix (`react` must not match `react-hook-form`).
 */
export function packageNameOf(moduleId) {
  const normalized = moduleId.replaceAll("\\", "/")
  const marker = "node_modules/"
  const index = normalized.lastIndexOf(marker)
  if (index === -1) return null

  const segments = normalized.slice(index + marker.length).split("/")
  const [first, second] = segments
  if (!first) return null
  return first.startsWith("@") ? `${first}/${second ?? ""}` : first
}

/** True for resolved module ids that live under a `node_modules` directory. */
export function isNodeModule(moduleId) {
  return moduleId.replaceAll("\\", "/").includes("node_modules/")
}

function byPackage(names) {
  return (moduleId) => {
    const name = packageNameOf(moduleId)
    return name !== null && names.includes(name)
  }
}

export const VENDOR_GROUPS = [
  {
    name: "vendor-react",
    test: byPackage(["react", "react-dom", "scheduler"]),
    tags: [INITIAL_TAG],
  },
  {
    name: "vendor-base-ui",
    test: byPackage([
      "@base-ui/react",
      "@base-ui/utils",
      "@floating-ui/core",
      "@floating-ui/dom",
      "@floating-ui/react",
      "@floating-ui/react-dom",
      "@floating-ui/utils",
    ]),
    tags: [INITIAL_TAG],
  },
  {
    name: "vendor-router",
    test: byPackage(["react-router", "react-router-dom"]),
    tags: [INITIAL_TAG],
  },
  {
    name: "vendor-i18n",
    test: byPackage(["i18next", "react-i18next"]),
    tags: [INITIAL_TAG],
  },
  {
    name: "vendor-sonner",
    test: byPackage(["sonner"]),
    tags: [INITIAL_TAG],
  },
  {
    // Last of the named families: `includeDependenciesRecursively` pulls each
    // matched package's dependency closure into its group, and Refine depends
    // on router/query/qs. Listing it after the narrower families keeps those
    // packages in their own chunks.
    name: "vendor-refine",
    test: byPackage([
      "@refinedev/core",
      "@refinedev/react-hook-form",
      "@refinedev/react-router",
      "@refinedev/react-table",
      "@refinedev/simple-rest",
      "@tanstack/query-core",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
      "@tanstack/table-core",
      "@tanstack/virtual-core",
      "lodash-es",
      "qs",
      "query-string",
    ]),
    tags: [INITIAL_TAG],
  },
  {
    name: "vendor-misc",
    test: isNodeModule,
    tags: [INITIAL_TAG],
    // Listed last so the family groups above capture their packages first at
    // equal priority; this catches only the initial-closure vendors no family
    // names. Do not give it a lower `priority`: the family groups would stop
    // winning the shared modules.
    minSize: 20_000,
  },
]

export const VENDOR_FAMILIES = VENDOR_GROUPS.map((group) => group.name)

/** `build.rolldownOptions.output.codeSplitting` for the app build. */
export const VENDOR_CODE_SPLITTING = {
  minSize: 20_000,
  // Rolldown measures `maxSize` against pre-minified module sizes, so a family
  // whose emitted chunk is ~180 kB can exceed 250 kB of source and be split
  // into several chunks. One family per chunk is the cache-stability goal;
  // the emitted-byte gate (500 kB) is the real ceiling.
  maxSize: 1_000_000,
  groups: VENDOR_GROUPS,
}
