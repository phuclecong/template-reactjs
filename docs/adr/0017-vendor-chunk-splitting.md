# Vendor chunks are split by family for cache stability

**Status**: accepted

The initial closure's third-party modules are split into named family chunks (`vendor-react`, `vendor-base-ui`, `vendor-refine`, `vendor-router`, `vendor-i18n`, `vendor-sonner`, `vendor-misc`) with rolldown's `codeSplitting.groups`, restricted to `$initial` modules. The entry chunk becomes app code only. This removes the single 731 kB entry without raising the warning limit, and gives vendor files content hashes that survive app-only releases.

## Context

The entry chunk is 731,557 B raw / 233.20 kB gzip and is almost entirely vendor code; route, overlay, and mock-worker code are already split. Vite warns at 500 kB per chunk.

Splitting vendor code does not reduce cold-start bytes or LCP. The measured `/tasks` LCP is dominated by the request-time MSW chunk and the 150-task seed (ADR-0010's measurement contract). The benefit is structural: an app/vendor boundary with stable cache keys, readable bundle composition, and a build that is warning-free for the right reason.

## Considered Options

- **Raise `chunkSizeWarningLimit`**: removes the warning without changing the underlying single-file boundary. Rejected — it hides the structural signal the warning exists to surface.
- **One `vendor` group with only `maxSize`**: let rolldown choose boundaries automatically. Rejected — boundaries and names re-shuffle whenever a dependency grows, so hashes change for unrelated reasons and the composition is hard to review.
- **One chunk per package**: maximum cache granularity. Rejected — request count and module preload traffic grow, and small packages produce micro-chunks.
- **Leave the entry as-is and pursue byte reductions elsewhere**: defer the Toaster, shell `@base-ui` pieces, and i18n catalogs instead. Rejected for this change — it is a different effort with UX risk, and the vendor boundary is worth having on its own. It remains available as follow-up work.
- **Family groups tagged `$initial` (chosen)**: stable names, stable hashes, route-only vendor code stays deferred.

## Consequences

- The group definitions live in `apps/web/scripts/perf/vendor-groups.mjs` and are consumed by `vite.config.ts`; `scripts/perf/verify-real-build.mjs` asserts the emitted chunk boundaries from a `dist/.vite/chunk-report.json` produced at build time.
- Initial vendor scripts increase from none to seven chunks. Vite module-preloads the entry's static imports, so they download in parallel; the acceptance tolerance is a 2% increase in per-route aggregate JS transfer.
- Vendor chunks are shared by route chunks, so route-specific vendor code must not be hoisted. Every group carries `$initial`, and the gate asserts that `date-fns`, `react-day-picker`, and `@tanstack/react-table` are outside the initial closure.
- Per-route byte budgets are restored and re-ratcheted as part of the change; the `"*": 500,000` drift is corrected to the documented 300,000 B default, so the split's byte delta is not absorbed by a loose ceiling.
- The cache benefit is not observable in the Lighthouse harness, which measures cold contexts by design. It must never be cited as a lab improvement.
- The 500 kB warning limit stays at its default, so a future regression still surfaces.
