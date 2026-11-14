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

| Signal                 | Dev-server audit (2026-11-14)                       | Production build                                |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Entry                  | `http://localhost:5173/dashboard/tasks`             | `apps/web/dist`                                 |
| JS requests            | 196, unminified modules                             | 1 chunk                                         |
| JS transfer            | 10,780 KiB total (unminified)                       | 1.6 MB raw / 559 KB gzip                        |
| CSS                    | Served through the module graph                     | 92 KB raw / 14.5 KB gzip                        |
| Performance score      | 0.55                                                | measured by work item 6.1                       |
| FCP / LCP              | 5.8 s / 11.1 s                                      | measured by work item 6.1                       |
| TBT / CLS              | 20 ms / 0                                           | measured by work item 6.1                       |

The 0.55 score and 11.1 s LCP describe Vite's module graph, not what a user downloads. Auditing the dev server is never evidence (ADR-0010).

## 3. What is actually slow

- **One eager chunk.** `App.tsx` imports every route and heavy overlay at module scope; there is no `React.lazy` anywhere. Every route shares the 559 KB gzip entry, including views a user never visits.
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

### 6.3 Route-level splitting and loading states

`React.lazy` the five route views; keep `App`, the providers, and `DashboardLayout` eager. Add page-shaped `Suspense` fallbacks, a neutral auth skeleton (no identity, no task data), and a table skeleton while data loads. Prefetch a route chunk on link hover/focus/pointerdown only.

**Acceptance**

- Each route's initial chunk excludes the other routes (verified from the build manifest).
- No route chunk is requested at startup or while idle.
- No screen is blank during auth, chunk load, or data load; CLS stays ≤ 0.1.
- Per-route JS bytes fall relative to the 6.1 baseline.

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
