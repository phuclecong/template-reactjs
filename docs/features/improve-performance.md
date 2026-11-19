# Vendor code splitting for a small entry chunk

**Status**: accepted
**Tracking**: [#73](https://github.com/phuclecong/template-reactjs/issues/73)
**Decision records**: `docs/adr/0017-vendor-chunk-splitting.md`
**Related**: `docs/features/performance.md`, ADR-0010

## 1. Problem

The production build emits one oversized entry chunk:

```
dist/assets/index-CqdnrA8I.js   731,557 B │ gzip: 233.20 kB
```

Every route view is already a separate chunk; the entry is vendor-heavy, not app-heavy. Measured from the build's sourcemap (minified bytes contributed by each package):

| Source                                       | Bytes   |
| -------------------------------------------- | ------- |
| react-dom                                    | 174.5 k |
| `@base-ui/react` + `@base-ui/utils`          | 134.0 k |
| `@refinedev/core`                            | 61.2 k  |
| i18next                                      | 48.6 k  |
| react-router                                 | 41.7 k  |
| sonner                                       | 32.7 k  |
| `@tanstack/query-core`                       | 32.2 k  |
| qs                                           | 19.7 k  |
| lodash-es                                    | 18.3 k  |
| `@workspace/ui`                              | 18.2 k  |
| `@floating-ui/*`                             | 15.7 k  |
| app source, translations, skeletons, sidebar | ~90 k   |

Two facts shape the design:

1. **Vendor splitting does not make cold startup faster.** It splits one download into several and adds per-chunk compression and request overhead. The measured `/tasks` LCP is dominated by the request-time MSW chunk and the 150-task seed (`performance.md` §6.6), not by entry chunk count. What the split buys is a cache-stable vendor boundary and a warning-free build.
2. **The entry is already an app/vendor boundary problem, not a route-loading problem.** Route-level and overlay-level splitting are done (`performance.md` §6.3–6.4); what remains is that first-party code and third-party code share one file.

At the start of this work, `perf-budgets.json` carried only `"*": 500_000` JS / `15_000` CSS. Commit `d1d1c42` replaced the per-route ceilings (`/login` 315,333 B, `/tasks` 560,228 B) with that default, loosening `/login` against the documented "never loosen" ratchet (`performance.md` §5, §6.5). That drift is corrected before this split is measured, so the split's byte delta is not hidden inside a loose default.

## 2. Goals and non-goals

**Goals**

- Remove the >500 kB chunk warning without raising `chunkSizeWarningLimit`.
- Make the entry chunk contain only first-party and workspace code, under 150,000 B raw.
- Give vendor code named, family-based chunks whose hashes stay stable across app-only releases.
- Keep cold-load aggregate JS transfer within 2% of the pre-split measurement on every audited route.
- Enforce the chunk contract from the built artifact in CI.

**Non-goals**

- Reducing startup bytes or LCP. Deferring the Toaster, shell `@base-ui` pieces, or i18n catalogs is a separate byte-reduction effort.
- Replacing libraries (React, Refine, base-ui, MSW).
- Changing the mock-backend request-time contract, the seed, or the Lighthouse thresholds.
- Virtualization, memoization sweeps, or RUM.
- Storybook's bundle.

## 3. Language

These are implementation terms; they stay in this spec and are deliberately not added to `GLOSSARY.md`, which is domain-only.

**Entry chunk**:
The script `index.html` loads statically. After this change it is the app chunk.

**App chunk**:
The entry chunk's contents once vendor code is split out: first-party `src/`, `@workspace/ui`, `@workspace/shared-lib`, schemas, and translation catalogs.

**Vendor chunk**:
A named chunk containing third-party modules from the initial closure, grouped by family (`vendor-react`, `vendor-base-ui`, …).

**Route chunk**:
A dynamically imported chunk for one route view (`src/routes/*`), requested on navigation or intent, never at startup.

**Overlay chunk**:
A dynamically imported chunk for a dialog or bulk-action surface, requested on trigger intent.

**Initial closure**:
Every module reachable through static imports from `index.html`: the entry plus its statically imported chunks. Rolldown tags these modules `$initial`.

**Request-time chunk**:
A chunk requested only after a user or data event — the MSW worker is the current example.

**Cache stability**:
A file's content hash changes only when its own code changes. Vendor chunks should survive app-only releases; app chunks should not be invalidated by dependency upgrades.

## 4. Design

The split uses Vite 8's native rolldown option, not the deprecated `manualChunks`/`advancedChunks`:

```ts
build: {
  rolldownOptions: {
    output: {
      codeSplitting: {
        minSize: 20_000,
        // Measured against pre-minified module sizes; see the size-guard rule.
        maxSize: 1_000_000,
        groups: [/* … */],
      },
    },
  },
}
```

Groups, in order, each tagged `tags: ["$initial"]` so route-only vendor code is never hoisted:

| Group            | Modules                                                           | Approx. raw |
| ---------------- | ----------------------------------------------------------------- | ----------- |
| `vendor-react`   | `react`, `react-dom`, `scheduler`                                 | 178 k       |
| `vendor-base-ui` | `@base-ui/*`, `@floating-ui/*`                                    | 150 k       |
| `vendor-refine`  | `@refinedev/*`, `@tanstack/*`, `qs`, `query-string`, `lodash-es`  | 141 k       |
| `vendor-router`  | `react-router`, `react-router-dom`                                | 42 k        |
| `vendor-i18n`    | `i18next`, `react-i18next`                                        | 54 k        |
| `vendor-sonner`  | `sonner`                                                          | 33 k        |
| `vendor-misc`    | remaining initial-closure `node_modules` (`test: /node_modules/`) | ~24 k       |

Rules:

- **Initial closure only.** Every group carries `tags: ["$initial"]`. `date-fns`, `react-day-picker`, `@tanstack/react-table`, and zod remain in the route/overlay chunks that already defer them.
- **Order matters.** `includeDependenciesRecursively` pulls each matched package's dependency closure into its group, so the broad `vendor-refine` family must come after the narrower families it depends on (`router`, `i18n`, `sonner`); otherwise it captures `react-router`, `qs`, and `@tanstack/query-core` first. `vendor-misc` stays last and relies on group order, not a lower `priority` — a lower priority on the catch-all made it win the shared modules in practice.
- **Anchored tests.** Module ids are pnpm-resolved paths. `packageNameOf` strips to the package directory after the last `node_modules/` segment, with `[\\/]` separators (Windows-safe), so `react` cannot capture `react-hook-form`, `react-i18next`, `react-router`, or `react-day-picker`. Representative resolved ids are unit-tested.
- **Size guards.** Rolldown measures `maxSize` against pre-minified module sizes, so the original `250_000` split a family whose emitted chunk was only ~180 kB into five or six pieces. `maxSize` is therefore a `1_000_000` source-size backstop; the emitted-byte gate (no chunk > 500,000 B, each family ≤ 250,000 B) is the real ceiling. `minSize: 20_000` prevents micro-chunks; if `vendor-misc` ever falls below it, the group is ignored and its modules fall back to automatic chunking — the gate below then fails, prompting a config adjustment rather than silent growth of the entry.
- **Dependency safety.** Keep `includeDependenciesRecursively` at its default (`true`) and do not set `strictExecutionOrder`. Transitive dependencies (`object-inspect`, `get-intrinsic`, `use-sync-external-store`) are captured by the group that imports them. A circular-chunk report means the groups need re-cutting, not an execution-order flag.
- **Translations stay in the app chunk.** `src/utils/translations/*` changes with product copy; keeping it out of `vendor-i18n` preserves vendor cache stability.
- **No preload changes need to be hand-written.** Vite emits `<link rel="modulepreload">` for the entry's static imports, so vendor chunks are fetched in parallel with the entry, not in a waterfall. The gate asserts that only the initial closure is preloaded.
- **No `chunkSizeWarningLimit` change.** The warning remains a real signal; the gate is stricter than the warning.

### Gate data source

`build.manifest` records chunk files and import relationships but not which modules a chunk contains, so the "entry has no vendor modules" claim needs one more artifact. A small `generateBundle` plugin in `vite.config.ts` writes `dist/.vite/chunk-report.json` — `{ file: [moduleId, …] }` per emitted JS chunk — only when `CHUNK_REPORT=1`, which `verify:real-build` sets. Production builds do not emit it, because it contains absolute module paths. `scripts/perf/verify-real-build.mjs` already builds both modes in CI and is the natural owner of the assertions:

- `findOversizedChunks(chunkSizes)` — no emitted JS chunk > 500,000 B raw.
- `findEntryChunk(manifest, report)` — the entry chunk's modules and file; the boundary assertion then requires under 150,000 B and no module id containing `[\\/]node_modules[\\/]`.
- `assertVendorFamilies({ report, sizes })` — every expected family has at least one chunk, one of its chunks contains the family's package, every chunk split from the family is ≤ 250,000 B emitted, and every chunk has a recorded size.
- `assertInitialClosure({ manifest, html, report })` — `date-fns`, `react-day-picker`, `@tanstack/react-table`, and zod appear in no chunk of the entry's static import closure, and `index.html` references exactly the closure: nothing extra (no route, overlay, or MSW chunk) and nothing missing (no preload waterfall).

The pure functions are unit-tested in `test/perf-real-build.test.ts` with fixture reports, including a negative case per assertion. Missing size data fails the gate rather than being skipped.

## 5. Measurement and acceptance

### Sequencing

1. **Restore the budgets.** Run `pnpm perf` on the current build and record every audited route's medians before applying the split, so the split's delta is visible. Restore an explicit ceiling for every audited route with `ceil(measured × 1.05)` (subject to the never-loosen rule), and return the `"*"` default to the documented 300,000 B JS — the `d1d1c42` value of 500,000 B was the drift, not a renegotiation. `/tasks` keeps its previously documented 411,893 B ceiling because `min(411,893, ceil(392,320 × 1.05))` is 411,893.
2. **Split.** Apply the group config, rebuild, and re-run `pnpm perf`.
3. **Re-ratchet.** Apply `newCeiling = min(currentCeiling, ceil(measured × 1.05))` per route. The 2% cold-load tolerance plus the ×1.05 ratchet headroom means a small per-chunk overhead should still fit under the pre-split ceilings; if it does not, the response is to merge a small family (sonner into `vendor-misc`, or drop `vendor-router`) and re-measure, not to loosen the budget.

### Acceptance

1. No emitted JS chunk exceeds 500,000 B raw; the entry/app chunk is under 150,000 B raw and contains no `node_modules` module.
2. Each vendor family chunk contains its intended package(s) and is at most 250,000 B emitted.
3. `date-fns`, `react-day-picker`, `@tanstack/react-table`, and zod are absent from the entry's static import closure; `index.html` references exactly the initial closure — no route, overlay, or MSW chunk, and no missing preload.
4. `pnpm perf`: no audited route's aggregate JS transfer is more than 2% above its pre-split median. Timing metrics are recorded but are not a gate for this change; the `/tasks` LCP gap stays with [#35](https://github.com/phuclecong/template-reactjs/issues/35).
5. Byte budgets are green, explicit for every audited route, keep `/tasks` at 411,893 B, return `"*"` to 300,000 B, and block in CI.
6. `verify:real-build` passes in both modes; the real build still emits no MSW chunk or preload.
7. `pnpm lint`, `pnpm typecheck`, unit, e2e, and Storybook pass.

### Measured result (2026-11-19)

Build: entry/app chunk `index-*.js` falls from 731,557 B raw / 233.20 kB gzip to **58,679 B raw / 17.2 kB gzip**, containing only first-party and workspace modules. No emitted JS chunk exceeds 500,000 B; the largest is 189,644 B.

| Chunk               | Raw bytes | Gzip    |
| ------------------- | --------- | ------- |
| `vendor-react`      | 189,644   | 59.0 kB |
| `vendor-refine`     | 182,440   | 57.1 kB |
| `vendor-base-ui`    | 167,165   | 55.7 kB |
| `vendor-i18n`       | 54,952    | 17.8 kB |
| `vendor-misc`       | 46,073    | 17.9 kB |
| `vendor-router`     | 43,737    | 15.5 kB |
| `vendor-sonner`     | 33,568    | 9.3 kB  |
| app entry (`index`) | 58,679    | 17.2 kB |

`index.html` preloads the entry, `rolldown-runtime`, the seven vendor chunks, and the shared button chunk. No route, overlay, or MSW chunk is preloaded, and none of `date-fns`, `react-day-picker`, `@tanstack/react-table`, or zod appears in the initial closure. `vendor-refine` also contains `src/utils/stubs/axios.ts`, pulled in by `@refinedev/simple-rest`'s recursive dependency capture; that tiny stub is the only first-party module in a vendor chunk.

Two consecutive `pnpm perf` runs produced identical byte medians. Against the pre-split baseline (`performance.md` §6.6), the transfer increase is 0.99–1.54% per route, inside the 2% tolerance:

| Route        | Pre-split JS | Post-split JS | Change |
| ------------ | ------------ | ------------- | ------ |
| `/dashboard` | 252,000      | 255,872       | +1.54% |
| `/login`     | 284,728      | 288,683       | +1.39% |
| `/register`  | 284,710      | 288,663       | +1.39% |
| `/roles`     | 419,258      | 423,418       | +0.99% |
| `/settings`  | 285,437      | 289,394       | +1.39% |
| `/tasks`     | 392,320      | 396,479       | +1.06% |
| `/users`     | 387,744      | 391,818       | +1.05% |

Per-route ceilings were restored from the pre-split measurement with `ceil(measured × 1.05)` and then re-ratcheted with `min(current, ceil(post-split × 1.05))`. `/tasks` stays at its previously documented 411,893 B (the fresh pre-split value `ceil(392,320 × 1.05) = 411,936` is higher, so the never-loosen rule keeps 411,893); the other six audited routes were seeded from the pre-split run and held after the split. The `"*"` default returned to 300,000 B. CSS is unchanged at 14,434 B. Timing was recorded but is not gated: the second run measured `/tasks` LCP 4,153 ms, TBT 127 ms, score 0.85, consistent with the pre-existing `#35` gap.

## 6. Risks

- **Request overhead.** Six or seven initial scripts instead of one can raise transfer slightly. `modulepreload` keeps them parallel; the 2% tolerance bounds the regression and the grouping is adjusted if it is exceeded.
- **Accidental eager vendor.** A group without `$initial`, an over-broad regex, or a new static import in `main.tsx` can pull route-only code into the first load. The entry size ceiling, the module-level chunk report, and the negative assertions catch it.
- **Circular chunks.** Explicit family groups can produce cross-group cycles. Keep default dependency inclusion; re-cut groups rather than enabling `strictExecutionOrder`.
- **Regex overreach.** A prefix match such as `/react/` would capture `react-hook-form`, `react-i18next`, `react-router`, and `react-day-picker`. Anchored package-directory tests and the family-content assertion catch it.
- **Budget drift masked the baseline.** The `"*": 500,000` default would hide a real regression. Restore per-route ceilings first.
- **Cache benefit is not visible in the lab.** The harness uses cold contexts by design; the cache-stability gain appears on repeat visits and across releases. It is stated as the rationale, never claimed as a Lighthouse result.

## 7. Done condition

1. The build emits no JS chunk over 500,000 B, and the entry/app chunk is under 150,000 B with no vendor modules.
2. Route-only vendor code is still deferred, and only the initial closure is preloaded.
3. `pnpm perf` shows no route more than 2% above its pre-split JS transfer, and the re-seeded per-route budgets pass.
4. The CI build-output assertions and their unit tests pass.
5. Lint, typecheck, unit, e2e, Storybook, and the real-build check pass.
6. This spec's **Measured result** section is filled, ADR-0017 is marked accepted, and `performance.md` §6.7 records the result.
