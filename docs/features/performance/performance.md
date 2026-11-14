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

| Signal            | Dev-server audit (2026-11-14)           | Production build (2026-11-14)             |
| ----------------- | --------------------------------------- | ----------------------------------------- |
| Entry             | `http://localhost:5173/dashboard/tasks` | `apps/web/dist`, served by `vite preview` |
| JS requests       | 196, unminified modules                 | 1 chunk                                   |
| JS transfer       | 10,780 KiB total (unminified)           | 1.72 MB raw / 560 kB gzip over the wire   |
| CSS               | Served through the module graph         | 91.4 kB raw / 14.9 kB gzip over the wire  |
| Performance score | 0.55                                    | 1.00 `/login`; 0.74 `/dashboard/tasks`    |
| FCP / LCP         | 5.8 s / 11.1 s                          | 904 ms / 904 ms; 3,780 ms / 4,059 ms      |
| TBT / CLS         | 20 ms / 0                               | 59 ms / 0; 290 ms / 0                     |

The 0.55 score and 11.1 s LCP describe Vite's module graph, not what a user downloads. Auditing the dev server is never evidence (ADR-0010).

### Measured production baseline (work item 6.1)

Recorded 2026-11-14 from `pnpm perf` on the pre-optimization build: `vite build`, served by `vite preview`, Lighthouse mobile (simulated Slow 4G, 4× CPU), three cold runs per route, medians shown. These are the **pre-optimization** numbers the byte budgets were seeded from (work item 6.5 ratchets them lower). The `/dashboard/tasks` timing floor is not yet green: the initial LHCI gate requires score ≥ 0.85 and LCP ≤ 3.5 s, and the gap is what work items 6.2–6.4 address.

| Route              | JS transfer | CSS transfer | FCP      | LCP      | TBT    | CLS   | Score |
| ------------------ | ----------- | ------------ | -------- | -------- | ------ | ----- | ----- |
| `/login`           | 560,228 B   | 14,875 B     | 904 ms   | 904 ms   | 59 ms  | 0.000 | 1.00  |
| `/dashboard/tasks` | 560,228 B   | 14,875 B     | 3,780 ms | 4,059 ms | 290 ms | 0.000 | 0.74  |

The byte figures are Lighthouse's `network-requests` `transferSize` (compressed bytes plus headers), summed for `Script` and `Stylesheet`; they seeded the original byte ceilings. The dev-server report above remains discarded evidence — it is never recorded as a baseline.

### Post-optimization baseline (work item 6.5)

Recorded 2026-11-14 from two consecutive `pnpm perf` runs on the final mock build (`ticket/33-verify-ratchet`), three cold runs per route per run, medians shown. The harness now seeds the authenticated tab's `sessionStorage` directly and never loads the app or registers a service worker before the audit (§5, #33), so these are honest `transferSize` values and the first `/api` request is the cold seed of all 150 tasks.

| Route              | JS transfer | CSS transfer | FCP        | LCP            | TBT        | CLS   | Score |
| ------------------ | ----------- | ------------ | ---------- | -------------- | ---------- | ----- | ----- |
| `/login`           | 300,317 B   | 14,875 B     | 905 ms     | 905 ms         | 0–2 ms     | 0.000 | 1.00  |
| `/dashboard/tasks` | 553,891 B   | 14,875 B     | 906–907 ms | 4,621–4,628 ms | 142–147 ms | 0.000 | 0.82  |

Both runs produced identical byte medians (`/login` 300,317 B JS, `/dashboard/tasks` 553,891 B JS, 14,875 B CSS on both routes); repeat-run timing spread was 0 ms for `/login` LCP, 7 ms for `/dashboard/tasks` LCP, and 5 ms for TBT. `apps/web/perf-budgets.json` is ratcheted from these values (§6.5).

The honest numbers supersede the service-worker-masked harness figures recorded under 6.3 and 6.4 (494,993 B and 553,873 B for the tasks route, and #31's 437,015–570,180 B range). In those runs the UI login step had registered the mock worker before Lighthouse opened the audited tab, so dynamically imported route chunks were reported with `transferSize: 179` (headers only). With the fix, every `Script`/`Stylesheet` in both reports transfers a real body; `/login` requests no worker at all, and `/dashboard/tasks` pays the request-time worker chunk inside the measured cold visit, as the contract requires.

Timing verdict: `/login` meets the §7 targets. `/dashboard/tasks` meets CLS ≤ 0.1 and TBT ≤ 200 ms, but **does not** meet LCP ≤ 2.5 s, and also remains above the initial LHCI gate (LCP ≤ 3.5 s, score ≥ 0.85). The residual gap is recorded in §6.5 and §7; no assertion or measurement rule was relaxed to hide it.

## 3. What is actually slow

- **One eager chunk.** `App.tsx` imports every route and heavy overlay at module scope; there is no `React.lazy` anywhere. Every route shares the 560 KB gzip entry, including views a user never visits.
- **The mock backend gates first render.** `MswGate` renders `null` until `setupWorker().start()` resolves and 150 tasks are seeded, and MSW plus the mock data layer are inside the production bundle.
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
- **State**: a cold browser context per run. The 150-task seed is part of the measured first visit. The authenticated tab receives the deterministic `auth.session` value through `evaluateOnNewDocument` before app modules run; the harness never navigates the app or registers the mock service worker before the audit. No `localStorage` seed exists when the audit starts, so the first `/api` request starts the worker and seeds inside the measured visit.
- **Routes**: `/login` (unauthenticated entry) and `/dashboard/tasks` (heaviest authenticated view; its session is injected by the harness, not created by a UI login).
- **Runs**: three per route; assertions use the median, never a single run.
- **UX gates**: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms. FCP is tracked without a separate gate.
- **Byte budgets**: per-route initial JS plus render-blocking CSS, summed from the Lighthouse report's `network-requests` `transferSize` for `Script` and `Stylesheet`. Budgets are set from the post-optimization measurement and then ratchet: a regression above +5% fails. The ratchet rule is `newCeiling = min(currentCeiling, ceil(measured × 1.05))`, so a re-measurement can tighten a ceiling but never loosen one. Reports that contain a `Script` or `Stylesheet` with `transferSize ≤ 100` are rejected as possible service-worker masking / under-measurement.
- **CI**: byte budgets block immediately (they are deterministic), and a separate blocking step builds both the audited mock mode and a `VITE_API_URL` real-backend mode and asserts the real build emits no MSW chunk or preload. LHCI timing assertions block on the median with generous initial thresholds — score ≥ 0.85 and LCP ≤ 3.5 s. They are tightened only after two consecutive stable releases pass the target on both routes; a red route is fixed, never re-baselined by loosening the assertion.

## 6. Work items

### 6.1 Production measurement harness, baseline, and CI gate

`apps/web` owns `lighthouserc.*`, `scripts/perf/login.*` (Puppeteer session-seed step), `scripts/perf/budget.*` (report-derived byte totals plus the masking guard), `scripts/perf/verify-real-build.*` (both-mode build assertion), and `perf-budgets.json`. A root `pnpm perf` builds, previews, audits both routes cold, computes per-route JS/CSS bytes, and prints FCP/LCP/TBT/CLS medians. A CI job runs the same: byte check blocking, Lighthouse gate as in §5. The measured baseline is recorded in §2.

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

| Route              | JS transfer | CSS transfer | Change vs §2           |
| ------------------ | ----------- | ------------ | ---------------------- |
| `/login`           | 408,529 B   | 14,875 B     | JS −151,699 B (−27.1%) |
| `/dashboard/tasks` | 561,864 B   | 14,875 B     | JS +1,636 B (+0.3%)    |

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

| Route              | JS transfer | CSS transfer | FCP    | LCP      | TBT    | CLS   | Score |
| ------------------ | ----------- | ------------ | ------ | -------- | ------ | ----- | ----- |
| `/login`           | 299,759 B   | 14,875 B     | 905 ms | 905 ms   | 4 ms   | 0.000 | 1.00  |
| `/dashboard/tasks` | 494,993 B   | 14,875 B     | 906 ms | 4,316 ms | 233 ms | 0.000 | 0.82  |

- Both byte budgets pass. `/login` falls 260,469 B (−46.5%) against the §2 baseline; `/dashboard/tasks` falls 65,235 B (−11.6%) as measured. CSS is unchanged from the baseline because the skeletons use inline dimensions rather than new utility classes.
- The dashboard measurement is a lower bound on route-chunk body bytes: the login step registers the mock service worker before the audited tab opens, so Lighthouse attributes header-only transfer to the dynamically imported route chunks. Build-level gzip sizes are ~300 kB for `/login` and ~400 kB of route code for `/dashboard/tasks`, plus the ~171 kB request-time worker chunk. Bringing the tasks route itself below the old single-bundle total is the overlay split (6.4) plus the 6.5 re-seed.
- `build.manifest` records each `src/routes/*` chunk as a dynamic entry: every route entry imports only shared chunks and the entry, and no route entry imports another route entry. `index.html` preloads only the entry's static import; no route chunk is preloaded.
- A production preview probe on cold `/login`, `/dashboard/tasks`, and `/dashboard/settings` requested only the current route's chunk; four seconds of idle added no further route chunk. The sidebar and breadcrumb `IntentLink` prefetches on pointer enter, focus, or pointer down; unit and e2e tests assert nothing is fetched on mount, at startup, or while idle.
- The `/dashboard/tasks` Lighthouse timing gate remains red (LCP 4.3 s, score 0.82), the pre-existing gap recorded in §2; CLS is 0.000 on both routes and the byte budgets are green.
- **Superseded measurement:** the byte figures in this table were produced by the service-worker-masked harness. #33 fixed the harness; §2's post-optimization baseline is the current evidence, and the tasks route honestly measures 553,891 B and LCP ~4.6 s.

### 6.4 Overlay-level lazy loading and chunk failure handling

Lazy-load the task form dialog, delete dialog, and bulk actions; prefetch them on trigger intent. Add a shared `lazyWithRetry` (one retry, then a full reload) and an error boundary around route and overlay chunks. Split the calendar internals only if the tasks-route budget still fails after 6.3.

**Acceptance**

- Overlays load their content on demand and open correctly.
- A simulated chunk 404 shows a retry action and never a blank route.
- Tasks-route initial bytes meet the budget; if not, the calendar split is applied and measured.

**Measured result (work item 6.4, 2026-11-14)**

The form and delete dialogs stay in one deferred `task-dialogs` module; the bulk-actions popup (combobox content, `DatePicker`, confirmation dialog) moved to a deferred `task-bulk-actions-content` module. The persistent bulk toolbar — selection count, bulk-actions trigger, and **New task** — remains eager, so first paint keeps its triggers. `TaskActionsCell` keeps stable intent callbacks, so its memo is not invalidated. Every overlay chunk is prefetched on pointer enter, focus, or pointer down of its trigger; nothing is requested at startup or while idle, and a prefetch failure is swallowed (the rendered overlay owns the retry/reload path).

`lazyWithRetry` retries a failed import once. On repeated failure it marks `sessionStorage` and performs one full reload; after that marker exists, a still-missing chunk rejects to the error boundary instead of reloading in a loop. `ChunkErrorBoundary` is a dependency-free class component that renders the translated `error.*` copy and a **Try again** button; retrying creates a fresh `React.lazy` identity because React caches a loader's rejection.

| Measurement                                     | Before 6.4                  | After 6.4                            | Change                  |
| ----------------------------------------------- | --------------------------- | ------------------------------------ | ----------------------- |
| Honest build-level tasks initial JS (gzip body) | 565,006 B                   | 548,004 B                            | −17,002 B (−3.0%)       |
| `pnpm perf` tasks JS transfer (median)          | 494,993 B                   | 553,873 B                            | +58,880 B               |
| `pnpm perf` tasks CSS transfer (median)         | 14,875 B                    | 14,884 B → 14,875 B                  | 0 B after the fix below |
| Budget                                          | 560,228 B JS / 14,875 B CSS | 548,004 B honest / 553,873 B harness | Both bytes budgets pass |

- The honest figure is computed from `dist/.vite/manifest.json` plus per-file gzip: entry closure + `src/routes/tasks.tsx` closure + the request-time `src/utils/msw.ts` closure, the chunks requested before any user interaction. The harness number is larger here because it includes response headers; it is used as the conservative value. Both are below the 560,228 B ceiling.
- The 6.3 harness median (494,993 B) is known to under-measure the authenticated route (service-worker-masked dynamic chunk bodies). The apparent +58,880 B is measurement variance between runs, not new code: the honest build-level figure falls by 17,002 B. This ticket does not modify the harness (#33 owns that fix).
- The harness is not evidence of true initial bytes: the login step registers the service worker before Lighthouse opens the audited tab, so route chunks can be reported as header-only transfers. 6.4 does not change the harness; the honest build-level figure is the decision input and #33 owns the measurement fix/re-seed.
- The first harness run after the split reported CSS 14,884 B, 9 B over the ceiling. The cause was a Tailwind candidate extracted from the word "grow" in a code comment, which emitted an otherwise-unused `.grow` rule. Rewording the comment makes the stylesheet byte-identical to the 6.3 build (91,428 raw, 14,404 gzip), so the transfer returns to the 14,875 B baseline. No budget file was changed.
- **Calendar split: not applied.** The tasks route is under budget before it. `@workspace/ui/lib/date` remains in the initial tasks closure because the table formats Due date and the filters use `DateRangePicker`; deferring `DatePicker` alone cannot remove `date-fns`/day-picker locale code. Splitting calendar internals would not reduce the measured initial bytes.
- Overlay chunks are deferred: `task-dialogs` (2,360 B gzip) and `task-bulk-actions-content` (815 B gzip), plus their still-deferred dependency slices. The marginal open-time cost is paid only when a trigger is used.
- A Playwright spec intercepts the Settings route module and answers 404: the shell stays mounted, the translated alert and **Try again** appear, and retrying after the interception stops recovers the Settings heading. Boundary/`RetryableLazy` unit tests cover overlay failure, the one-retry contract, no unhandled rejection, and fresh-attempt recovery.
- The `/dashboard/tasks` Lighthouse timing gate remains red (LCP 4,617 ms, score 0.81), the pre-existing gap recorded in §2; CLS is 0.000, TBT is 144 ms, and the byte budgets pass.
- **Superseded measurement:** the 553,873 B "after" harness figure happened to be close to the honest total, but the 494,993 B "before" figure was service-worker-masked. #33 fixed the harness; use §2's post-optimization baseline (553,891 B, LCP 4,621–4,628 ms) as the current measurement.

### 6.5 Verification and ratchet

Re-run both routes, record the post-optimization baseline, set the byte budgets, tighten the Lighthouse thresholds, and confirm the real-backend build. Update this spec.

**Acceptance**: the §7 done condition.

**Measured result (work item 6.5, 2026-11-14)**

_Measurement integrity._ `scripts/perf/login.cjs` no longer navigates the app or logs in through the UI. It computes the deterministic `mock.<base64url(claims)>` token for `usr_admin` and injects `sessionStorage["auth.session"] = JSON.stringify({ token, user })` into every audited page target with `evaluateOnNewDocument`; `settings.disableStorageReset: true` preserves it. Because the app never boots in the login step, the audited tab starts with no service worker and no `localStorage` seed, and the first `/api` request starts the worker and seeds all 150 tasks inside the measured visit. `budget.mjs` now rejects any report whose `Script`/`Stylesheet` transfer is ≤ 100 B (possible service-worker masking / under-measurement), and `test/fixtures/perf/lhr-tasks-masked.json` covers the guard. Evidence from the fixed runs: every script transfers a real body (entry 227,708 B; route/shared chunks 511–55,043 B; request-time MSW chunk 169,297 B), no `179 B` entries exist, and no mock worker request precedes the audit. Two consecutive `pnpm perf` runs produced identical byte medians and single-digit-millisecond timing spread (§2).

_Byte budgets._ Ratchet rule: `newCeiling = min(currentCeiling, ceil(measured × 1.05))`. Applied to the honest medians:

| Route              | Metric | Measured  | `ceil(measured × 1.05)` | Previous ceiling | New ceiling                    |
| ------------------ | ------ | --------- | ----------------------- | ---------------- | ------------------------------ |
| `/login`           | JS     | 300,317 B | 315,333 B               | 560,228 B        | **315,333 B**                  |
| `/login`           | CSS    | 14,875 B  | 15,619 B                | 14,875 B         | **14,875 B**                   |
| `/dashboard/tasks` | JS     | 553,891 B | 581,586 B               | 560,228 B        | **560,228 B** (never loosened) |
| `/dashboard/tasks` | CSS    | 14,875 B  | 15,619 B                | 14,875 B         | **14,875 B**                   |

The gate is green on the recorded reports and blocking: lowering the `/login` JS ceiling to 300,000 B made the budget script exit 1 with `FAIL`, then the ceiling was restored. The tasks route cannot be ratcheted below 560,228 B under the +5% rule because its honest measurement is 553,891 B; the rule forbids loosening it to 581,586 B.

_CI real-backend check._ `apps/web/scripts/perf/verify-real-build.mjs` (script `pnpm --filter web verify:real-build`) builds the audited mock mode into `dist` and a `VITE_API_URL=http://example.test/api` mode into the gitignored `dist/real`, then asserts: the mock manifest contains the dynamic MSW chunk and does not preload it; the real manifest has no MSW chunk, no emitted script contains MSW runtime markers (`mockServiceWorker`, `setupWorker`, `@mswjs/interceptors`, `msw/browser`, `dataHandlers`), and `index.html` has no MSW preload/reference. The step is part of the blocking CI `ci` job. (The real output still contains the inert `public/mockServiceWorker.js` static copy; it is not a chunk, is never preloaded or registered by the real build, and can be excluded at deploy time.)

_Lighthouse thresholds._ The timing assertions stay at the initial contract (`score ≥ 0.85`, `LCP ≤ 3.5 s`). They are not tightened because `/dashboard/tasks` does not yet pass them and there are no two stable passing releases; tightening policy is documented in §5.

_Timing verdict._ `/login`: LCP 905 ms, CLS 0.000, TBT 0–2 ms — meets §7. `/dashboard/tasks`: LCP 4,621–4,628 ms (target ≤ 2,500 ms; initial gate ≤ 3,500 ms), CLS 0.000, TBT 142–147 ms. CLS and TBT pass; LCP and the score gate (0.82 vs ≥ 0.85) do not.

_Diagnosis of the residual tasks gap._ The cold authenticated route must download 553,891 B of JS (entry 227,708 B + route/shared closure ≈ 98,000 B + request-time MSW chunk 169,297 B) and seed 150 tasks on the first `/api` request. Under 4× CPU and Slow 4G simulation that structure floors LCP near 4.6 s. Starting `ensureMockWorker()` from the tasks route loader (in parallel with the route chunk, never at startup and never on `/login`) moved the MSW chunk request from ~440 ms to ~110 ms in the trace but did not change simulated LCP, which is bandwidth/CPU-bound. Trimming MSW's WebSocket interceptor would require aliasing an external package subpath (fragile), changes a runtime MSW installs, and its few-kilobyte saving cannot close a >1.1 s gap; it was not applied. No dataset, seeding point, or measurement rule was changed to flatter the result.

## 7. Done condition

1. Both `/login` and `/dashboard/tasks`, cold mobile lab, meet LCP ≤ 2.5 s, CLS ≤ 0.1, and TBT ≤ 200 ms.
2. Per-route JS + CSS byte budgets are green and blocking in CI.
3. A real-backend build emits no MSW chunk.
4. Lint, typecheck, unit, e2e, and Storybook all pass.
5. This spec, ADR-0010, ADR-0011, and `requirement.md` are updated.

If the post-optimization measurement already sits below the thresholds, "done" means holding them with the ratchet — not inventing further work.

**Actual results (2026-11-14, work item 6.5)**

| Condition                                              | Result      | Evidence                                                                                                                                                                                                                                |
| ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms on both routes | **NOT MET** | `/login` passes (LCP 905 ms, CLS 0.000, TBT 0–2 ms). `/dashboard/tasks` fails LCP at 4,621–4,628 ms (also above the 3.5 s initial gate); CLS 0.000 and TBT 142–147 ms pass.                                                             |
| 2. Byte budgets green and blocking in CI               | **MET**     | `/login` ratcheted to 315,333 B JS; `/dashboard/tasks` at 560,228 B; CSS 14,875 B both. Deliberately lowering a ceiling exits 1.                                                                                                        |
| 3. Real-backend build emits no MSW chunk               | **MET**     | Both-mode CI step asserts no MSW manifest entry, runtime marker, or preload in the `VITE_API_URL` build.                                                                                                                                |
| 4. Lint, typecheck, unit, e2e, Storybook pass          | **MET**     | `pnpm lint`, `pnpm typecheck`, `pnpm test` (web: 20 files / 142 tests; all package suites pass), `CI=1 pnpm --filter web test:e2e` (31 tests), and `pnpm --filter @workspace/ui test-storybook:ci` (29 suites / 95 tests) all exited 0. |
| 5. Spec, ADR-0010, ADR-0011, `requirement.md` current  | **MET**     | This document and both ADRs updated; `requirement.md` already asks for production performance budgets.                                                                                                                                  |

The honest `/dashboard/tasks` LCP gap is therefore the open item; the initial LHCI gate remains red rather than being relaxed.

## 8. Risks

- **Request waterfall.** Splitting can trade bytes for round trips; mitigate with intent-only prefetch and by keeping the shell and providers in the entry chunk.
- **Noisy lab timings on shared runners.** Median of three, a deterministic byte gate, and generous initial Lighthouse thresholds; tighten once stable.
- **Skeleton layout shift.** Skeletons must reserve the dimensions of the content they replace; CLS is part of the gate.
- **Mock and real builds diverging.** Both are built in CI; only the mock build is audited.
- **Seeding dominates the measurement.** Cold context is deliberate; seeding stays at first request, never at startup.
- **Service-worker masking.** A warm worker makes Lighthouse report header-only subresource transfers. The login step never registers one, and the byte script rejects any `Script`/`Stylesheet` ≤ 100 B; never re-introduce a UI login before the audit.
- **Cold mock route timing.** `/dashboard/tasks` honestly measures ~4.6 s LCP because the mock backend's 169 kB worker chunk and the 150-task seed are part of the measured first visit. The §7 target is unmet and the initial gate stays red; fixing it requires contract-level product decisions, not a budget or assertion change.
