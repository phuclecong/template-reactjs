/**
 * Browser-build stub for `papaparse`.
 *
 * `@refinedev/core` imports papaparse at module scope for its `useExport`
 * hook. This app has no export UI and never calls `useExport`, but the static
 * import keeps ~6 kB gzip of CSV machinery in every route. The stub preserves
 * the module shape and throws if export is ever invoked, so adding an export
 * feature fails loudly instead of downloading an empty file.
 */

function unsupported(): never {
  throw new Error(
    "CSV export is not included in this browser build; remove the papaparse stub in vite.config.ts to enable useExport."
  )
}

const papaparse = {
  parse: unsupported,
  unparse: unsupported,
}

export default papaparse
