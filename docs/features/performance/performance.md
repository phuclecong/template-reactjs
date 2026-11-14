# Performance optimization

**Status**: accepted
**Tracking**: spec [#34](https://github.com/phuclecong/template-reactjs/issues/34); work items [#29](https://github.com/phuclecong/template-reactjs/issues/29)–[#33](https://github.com/phuclecong/template-reactjs/issues/33)
**Decision records**: `docs/adr/0010-performance-measured-on-production-builds.md`, `docs/adr/0011-pagination-over-virtualization.md`
**Related**: `docs/features/requirement.md`, `task-table.md`, ADR-0005 (client-side data fetching), ADR-0009 (shadcn vendoring)

## 1. Summary

Users experience the app as fast or slow before they evaluate any single feature. This capability makes the first load fast, keeps the app responsive while in use, and holds both as routes and data grow.

The work is measured on the **production build**. The audit previously cited as the baseline was run against the Vite dev server and is not evidence about users (§2). The real risks in this app are first-load structure — one eager chunk and a mock backend that gates first render — plus the absence of a budget that would catch a regression (§3).

## 2. Why the previous baseline was discarded

The discarded report (`localhost-dashboard-tasks_2026-11-14_18-33-45.json`) is a Chrome DevTools Lighthouse run against `http://localhost:5173/dashboard/tasks` — the Vite **dev server**. The trace shows 196 requests, `@vite/client` and react-refresh in the dependency tree, and 10,780 KiB of unminified JavaScript (`unminified-javascript` alone estimated 4,229 KiB of savings). It is kept locally and gitignored; it is not a baseline.

| Signal                 | Dev-server audit (2026-11-14)                       | Production build (2026-11-14)                              |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Entry                  | `http://localhost:5173/dashboard/tasks`             | `apps/web/dist`, served by `vite preview`                  |
| JS requests            | 196, unminified modules                             | 1 chunk                                                    |
| JS transfer            | 10,780 KiB total (unminified)                       | 1.72 MB raw / 560 kB gzip over the wire                    |
| CSS                    | Served through the module graph                     | 91.4 kB raw / 14.9 kB gzip over the wire                   |
| Performance score      | 0.55                                                | 1.00 `/login`; 0.74 `/dashboard/tasks`                     |
| FCP / LCP              | 5.8 s / 11.1 s                                      | 904 ms / 904 ms; 3,780 ms / 4,059 ms                       |
| TBT / CLS              | 20 ms / 0                                           | 59 ms / 0; 290 ms / 0                                      |

The 0.55 score and 11.1 s LCP describe Vite's module graph, not what a user downloads. Auditing the dev server is never evidence (ADR-0010).

### Measured production baseline (work item 6.1)

Recorded 2026-11-14 from `pnpm perf` on the pre-optimization build: `vite build`, served by `vite preview`, Lighthouse mobile (simulated Slow 4G, 4× CPU), three cold runs per route, medians shown. These are the **pre-optimization** numbers the byte budgets were seeded from (work item 6.5 ratchets them lower). The `/dashboard/tasks` timing floor is not yet green: the initial LHCI gate requires score ≥ 0.85 and LCP ≤ 3.5 s, and the gap is what work items 6.2–6.4 address.

| Route              | JS transfer | CSS transfer | FCP     | LCP     | TBT    | CLS   | Score |
| ------------------ | ----------- | ------------ | ------- | ------- | ------ | ----- | ----- |
| `/login`           | 560,228 B   | 14,875 B     | 904 ms  | 904 ms  | 59 ms  | 0.000 | 1.00  |
| `/dashboard/tasks` | 560,228 B   | 14,875 B     | 3,780 ms | 4,059 ms | 290 ms | 0.000 | 0.74  |

The byte figures are Lighthouse's `network-requests` `transferSize` (compressed bytes plus headers), summed for `Script` and `Stylesheet`; they match the current `apps/web/perf-budgets.json` ceilings exactly. The dev-server report above remains discarded evidence — it is never recorded as a baseline.

## 3. What is actually slow

- **One eager chunk.** `App.tsx` imports every route and heavy overlay at module scope; there is no `React.lazy` anywhere. Every route shares the 560 KB gzip entry, including views a user never visits.
- **The mock backend gates first render.** `MswGate` renders `null` until `setupWorker().start()` resolves and 151 tasks are seeded, and MSW plus the mock data layer are inside the production bundle.
- **Blank waits.** `ProtectedRoute`, `RedirectIfAuthed`, and `DashboardLayout` return `null` while their async checks run, so a cold visitor can see a blank page rather than a loading surface.
- **No guardrail.** There is no production Lighthouse run, bundle budget, or CI check, so a regression is discovered by users.

Not supported by the code: unbounded lists (both tables are server-paginated at 10–100 rows), missing search debounce (300 ms), or re-render jank (68 `useMemo`/`useCallback`/`React.memo` uses; TBT 20 ms). The app ships no images and no web fonts, so image optimization has nothing to act on.

## 4. Goals and non-goals

**Goals**

- Establish a production measurement contract and keep it green across releases.
- Ship only the code an entry route needs; move mock infrastructure off first paint.
- Replace blank waits with skeletons that reserve layout.
- Make regressions visible in CI rather than in production.

**Non-goals**

- Backend infrastructure scaling and third-party service latency.
- A RUM vendor. Field INP is a follow-up once telemetry exists; this repo stays lab-only.
- The report's SEO (`meta-description`, `robots-txt`), favicon 404, and accessibility label mismatch — separate issues.
- Image optimization: no images or web fonts exist. Convention instead: any future image must be responsive, dimensioned, and lazy below the fold.
- Virtualization (ADR-0011).
- Synthetic interaction microbenchmarks; TBT is the lab proxy for INP.
- React Compiler or a blanket memoization sweep; apply memoization only where profiling shows real cost.

## 5. Measurement contract

- **Artifact**: `vite build` + `vite preview`. The dev server is never measured.
- **Profile**: Lighthouse mobile emulation — simulated Slow 4G (150 ms RTT, 1.6 Mbps down, 750 Kbps up) and 4× CPU slowdown.
- **State**: a cold browser context per run. The 151-task seed is part of the measured first visit.
- **Routes**: `/login` (unauthenticated entry) and `/dashboard/tasks` (heaviest authenticated view, reached through a login step).
- **Runs**: three per route; assertions use the median, never a single run.
- **UX gates**: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms. FCP is tracked without a separate gate.
- **Byte budgets**: per-route initial JS plus render-blocking CSS, summed from the Lighthouse report's `network-requests` `transferSize` for `Script` and `Stylesheet`. Budgets are set from the post-optimization measurement and then ratchet: a regression above +5% fails.
- **CI**: byte budgets block immediately (they are deterministic). LHCI timing assertions block on the median with generous initial thresholds — score ≥ 0.85 and LCP ≤ 3.5 s — and tighten once two releases are stable.

## 6. Work items

### 6.1 Production measurement harness, baseline, and CI gate

`apps/web` owns `lighthouserc.*`, `scripts/perf/login.*` (Puppeteer login step), `scripts/perf/budget.*` (report-derived byte totals), and `perf-budgets.json`. A root `pnpm perf` builds, previews, audits both routes cold, computes per-route JS/CSS bytes, and prints FCP/LCP/TBT/CLS medians. A CI job runs the same: byte check blocking, Lighthouse gate as in §5. The measured baseline is recorded in §2.

**Acceptance**

- `pnpm perf` reproduces both routes on a clean checkout.
- The report prints per-route JS/CSS bytes and FCP/LCP/TBT/CLS medians.
- CI fails when a byte budget or the timing floor is breached.
- The baseline table in §2 is filled with production numbers.

### 6.2 Mock backend off the critical path

Replace the startup `MswGate` with one shared worker promise created on the first `/api` request, seeding there. Import the worker with a dynamic `import()` behind the compile-time `VITE_API_URL` condition, so a real-backend build emits no worker chunk and preloads none. `/login` paints and accepts input before the worker exists; submitting shows a pending state until it resolves.

**Acceptance**

- A cold `/login` paints without requesting `mockServiceWorker.js` or any mock chunk.
- Login and dashboard data still work in mock mode; the e2e suite passes.
- A `VITE_API_URL` build's manifest contains no mock worker/handlers chunk.
- `/login` initial JS bytes fall relative to the §2 baseline.

**Measured result (work item 6.2, 2026-11-14)**

Recorded with `pnpm perf` on the `ticket/30-msw-off-critical-path` mock build, three cold runs per route, medians shown:

| Route              | JS transfer | CSS transfer | Change vs §2              |
| ------------------ | ----------- | ------------ | ------------------------- |
| `/login`           | 408,529 B   | 14,875 B     | JS −151,699 B (−27.1%)    |
| `/dashboard/tasks` | 561,864 B   | 14,875 B     | JS +1,636 B (+0.3%)       |

- The entry chunk drops from 564.7 kB gzip to 411.4 kB gzip. `msw/browser`, the handlers, and the auth service now live in a 154.5 kB gzip `msw-*.js` dynamic chunk that `index.html` neither references nor preloads. The mock collections and seed stay in the entry because route modules import the shared zod schemas; moving them would not change the tasks-route total.
- In a real-backend build (`VITE_API_URL=http://example.test/api`) the manifest has one static entry only: no dynamic worker/handlers chunk and no preload.
- Cold `/login` renders and accepts input without requesting `mockServiceWorker.js`; the worker starts on the first request (login submit or a list query), and the submit button stays pending through that wait.
- `/dashboard/tasks` still needs the worker at request time, so its total is the entry plus the worker chunk. The split costs one extra response and an independent compression stream, which is the +1,636 B and puts the route 0.29% over its current 560,228 B ceiling. The `/login` byte budget passes with 151,699 B of headroom; the tasks-route ceiling is left for the post-6.3 re-seed (6.5) rather than ratcheted here.

### 6.3 Route-level splitting and loading states

`React.lazy` the five route views; keep `App`, the providers, and `DashboardLayout` eager. Add page-shaped `Suspense` fallbacks, a neutral auth skeleton (no identity, no task data), and a table skeleton while data loads. Prefetch a route chunk on link hover/focus/pointerdown only.

**Acceptance**

- Each route's initial chunk excludes the other routes (verified from the build manifest).
- No route chunk is requested at startup or while idle.
- No screen is blank during auth, chunk load, or data load; CLS stays ≤ 0.1.
- Per-route JS bytes fall relative to the 6.1 baseline.

**Measured result (work item 6.3, 2026-11-14)**

Recorded with `pnpm perf` on the merged `ticket/31-route-splitting` mock build, three cold runs per route, medians shown:

| Route              | JS transfer | CSS transfer | FCP    | LCP     | TBT    | CLS   | Score |
| ------------------ | ----------- | ------------ | ------ | ------- | ------ | ----- | ----- |
| `/login`           | 299,759 B   | 14,875 B     | 905 ms | 905 ms  | 4 ms   | 0.000 | 1.00  |
| `/dashboard/tasks` | 494,993 B   | 14,875 B     | 906 ms | 4,316 ms | 233 ms | 0.000 | 0.82  |

- Both byte budgets pass. `/login` falls 260,469 B (−46.5%) against the §2 baseline; `/dashboard/tasks` falls 65,235 B (−11.6%) as measured. CSS is unchanged from the baseline because the skeletons use inline dimensions rather than new utility classes.
- The dashboard measurement is a lower bound on route-chunk body bytes: the login step registers the mock service worker before the audited tab opens, so Lighthouse attributes header-only transfer to the dynamically imported route chunks. Build-level gzip sizes are ~300 kB for `/login` and ~400 kB of route code for `/dashboard/tasks`, plus the ~171 kB request-time worker chunk. Bringing the tasks route itself below the old single-bundle total is the overlay split (6.4) plus the 6.5 re-seed.
- `build.manifest` records each `src/routes/*` chunk as a dynamic entry: every route entry imports only shared chunks and the entry, and no route entry imports another route entry. `index.html` preloads only the entry's static import; no route chunk is preloaded.
- A production preview probe on cold `/login`, `/dashboard/tasks`, and `/dashboard/settings` requested only the current route's chunk; four seconds of idle added no further route chunk. The sidebar and breadcrumb `IntentLink` prefetches on pointer enter, focus, or pointer down; unit and e2e tests assert nothing is fetched on mount, at startup, or while idle.
- The `/dashboard/tasks` Lighthouse timing gate remains red (LCP 4.3 s, score 0.82), the pre-existing gap recorded in §2; CLS is 0.000 on both routes and the byte budgets are green.

### 6.4 Overlay-level lazy loading and chunk failure handling

Lazy-load the task form dialog, delete dialog, and bulk actions; prefetch them on trigger intent. Add a shared `lazyWithRetry` (one retry, then a full reload) and an error boundary around route and overlay chunks. Split the calendar internals only if the tasks-route budget still fails after 6.3.

**Acceptance**

- Overlays load their content on demand and open correctly.
- A simulated chunk 404 shows a retry action and never a blank route.
- Tasks-route initial bytes meet the budget; if not, the calendar split is applied and measured.

### 6.5 Verification and ratchet

Re-run both routes, record the post-optimization baseline, set the byte budgets, tighten the Lighthouse thresholds, and confirm the real-backend build. Update this spec.

**Acceptance**: the §7 done condition.

## 7. Done condition

1. Both `/login` and `/dashboard/tasks`, cold mobile lab, meet LCP ≤ 2.5 s, CLS ≤ 0.1, and TBT ≤ 200 ms.
2. Per-route JS + CSS byte budgets are green and blocking in CI.
3. A real-backend build emits no MSW chunk.
4. Lint, typecheck, unit, e2e, and Storybook all pass.
5. This spec, ADR-0010, ADR-0011, and `requirement.md` are updated.

If the post-optimization measurement already sits below the thresholds, "done" means holding them with the ratchet — not inventing further work.

## 8. Risks

- **Request waterfall.** Splitting can trade bytes for round trips; mitigate with intent-only prefetch and by keeping the shell and providers in the entry chunk.
- **Noisy lab timings on shared runners.** Median of three, a deterministic byte gate, and generous initial Lighthouse thresholds; tighten once stable.
- **Skeleton layout shift.** Skeletons must reserve the dimensions of the content they replace; CLS is part of the gate.
- **Mock and real builds diverging.** Both are built in CI; only the mock build is audited.
- **Seeding dominates the measurement.** Cold context is deliberate; seeding stays at first request, never at startup.
