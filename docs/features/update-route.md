# Flatten `/dashboard/*` routes

**Status**: accepted
**Tracking**: none (requirement preserved verbatim in Appendix A)
**Decision records**: `docs/adr/0003-two-layer-auth.md`, `docs/adr/0006-feature-folders.md`, `docs/adr/0010-performance-measured-on-production-builds.md`, `docs/adr/0014-flat-authenticated-routes.md`
**Related**: `docs/features/performance.md`, `docs/features/error-boundaries.md`, `docs/features/logging-and-monitoring.md`, `apps/web/README.md`

## 1. Summary

The authenticated app currently nests Tasks, Users, and Settings under `/dashboard`. This change makes them top-level routes, leaves `/dashboard` as the placeholder home, and keeps every old URL working as a client-side redirect. The shell, auth gate, lazy chunks, and byte budgets are preserved; only the URL contract and the code keyed to it change.

| Path                                                          | Renders                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| `/`                                                           | redirect to `/dashboard`                                |
| `/login`, `/register`                                         | auth forms; authenticated visitors → `/dashboard`       |
| `/dashboard`                                                  | authenticated shell + heading-only `DashboardPage` placeholder |
| `/tasks`                                                      | authenticated shell + `TasksView`                       |
| `/users`                                                      | authenticated shell + `UsersView`                       |
| `/settings`                                                   | authenticated shell + `SettingsView`                    |
| `/dashboard/tasks`, `/dashboard/users`, `/dashboard/settings` | redirect to `/tasks`, `/users`, `/settings`             |

The requirement is `new /dashboard = empty placeholder page`; `/dashboard/tasks` → `/tasks`; `/dashboard/users` → `/users`; `/dashboard/settings` → `/settings`; update all internal links and redirects that point to the old paths. Appendix A keeps the original bullets verbatim.

## 2. Scope

**In scope:** `apps/web/src/App.tsx` (tree, aliases, index-redirect removal); new `apps/web/src/routes/dashboard.tsx`; `apps/web/src/routes/route-loaders.ts`; `apps/web/src/routes/dashboard-layout.tsx`, `apps/web/src/components/dashboard-shell.tsx`, and `apps/web/src/components/app-sidebar.tsx` (comments, crumbs, nav URLs, active state); unit/e2e/perf tests, harness config, budget key, and fixtures; the live docs listed in §4.7 and the new ADR. Auth redirect values are audited and stay at `/dashboard` and `/login` (§3.7).

**Out of scope:** renaming `apps/web/src/features/*` or revisiting ADR-0006; renaming `DashboardLayout`/`DashboardShell` (§3.4); designing the placeholder's content or adding a nav item; changing auth semantics, adding a return-to query, or changing logout; a catch-all/404 page, HTTP 301s, server rewrites, or preserving query/hash on legacy redirects; new dependencies, translation keys, or CSS classes; rewriting dated historical measurements or the preserved requirement appendix.

## 3. Design decisions

### 3.1 One pathless authenticated layout

`ProtectedRoute` wraps a pathless `<Route element={<DashboardLayout />}>` whose children are `/dashboard`, `/tasks`, `/users`, and `/settings`; `DashboardLayout` keeps rendering `DashboardShell` around `<Outlet />`. The three aliases are sibling top-level routes outside the gate. **Rationale:** one shell instance serves every authenticated page as before; the placeholder is a peer of the pages, not their parent; and the aliases render no protected content, so they need neither auth gating nor an `AppShellSkeleton` flash.

### 3.2 `/dashboard` owns the path

Delete the index `<Navigate to="/dashboard/tasks" replace />`. `/dashboard` renders a lazy `DashboardPage`: `<main className="p-6"><h1 className="text-lg font-medium">{t("shell.title")}</h1></main>`, with `fallback={null}` because the shell is already painted. The heading reuses the existing `shell.title` string ("Dashboard") and the `text-lg font-medium` class already emitted by Settings and the auth forms, so there are no new translation keys or CSS classes and the render-blocking CSS budget does not move. **Rationale:** the requirement gives the placeholder ownership of `/dashboard`; keeping the redirect would make it unreachable. A visible heading makes the intentionally empty page read as a destination rather than a failed render, and it adds no data hooks or failure surface. A lazy chunk keeps the page out of the entry closure and the `/login` and `/tasks` initial chunks; `fallback={null}` means no second skeleton.

### 3.3 Old URLs redirect

`/dashboard/tasks`, `/dashboard/users`, and `/dashboard/settings` use `<Navigate replace />` to their new paths, mounted outside `ProtectedRoute`; query strings and hashes are not preserved. Exact entries:

```tsx
<Route path="/dashboard/tasks" element={<Navigate to="/tasks" replace />} />
<Route path="/dashboard/users" element={<Navigate to="/users" replace />} />
<Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />
```

**Rationale:** the requirement explicitly says to "update all internal links and redirects that point to the old paths"; a 404 would break those links and bookmarks. The repo has no catch-all route, so "404" would currently render a blank `Routes` match, not a designed page. Redirects also match the existing `/` → `/dashboard` pattern. These are client-side `<Navigate replace />` redirects, not HTTP 301s; "permanent" means the alias stays mapped. Table state is URL state (`useTableState` writes `q`, filters, sort, and pagination to the address bar), so a legacy bookmark such as `/dashboard/tasks?status=todo&page=2` loses its view; no internal link emits a legacy URL with query state, and a redirect wrapper is not worth the surface for a transitional path. This is an accepted consequence, revisited only if legacy bookmarks with filters matter.

### 3.4 Keep the `Dashboard*` names

Keep `apps/web/src/routes/dashboard-layout.tsx` / `DashboardLayout` and `apps/web/src/components/dashboard-shell.tsx` / `DashboardShell`; update comments only, do not rename to `AppLayout`/`AppShell`. **Rationale:** "dashboard" names the product's authenticated surface (GLOSSARY now defines **Dashboard** as the authenticated area, not the `/dashboard` prefix). A rename would touch `apps/web/README.md` and the historical `docs/features/migrate-to-shadcn.md` for no behavioural gain; the names stay honest because the shell remains the dashboard's chrome on every authenticated route.

### 3.5 Breadcrumb labels and hrefs

The root crumb is always `{ href: "/dashboard", label: t("shell.title"), isCurrent: pathname === "/dashboard" }`. Strip only a leading `dashboard` segment, map remaining segments through `SEGMENT_LABELS` (raw-slug fallback), and build each href as `/${routeSegments.slice(0, index + 1).join("/")}`. **Rationale:** the old `.slice(1)` would now drop `tasks`, `users`, or `settings`; stripping only `dashboard` makes `/tasks` render "Dashboard > Tasks" with "Tasks" current and still gives future nested segments a sensible crumb.

### 3.6 Sidebar links and active state

`NAV_SECTIONS` URLs become `/tasks`, `/users`, and `/settings`; the brand/header `IntentLink` becomes `/dashboard`; `isActive` becomes `pathname === item.url || pathname.startsWith(`${item.url}/`)`. **Rationale:** navigation must point at rendered paths, or `IntentLink` prefetches a path with no loader. Exact match covers the three flat routes today; the prefix clause keeps a future `/tasks/:id` page highlighting Tasks. The brand link returns to the placeholder home with no active styling, as before.

### 3.7 Auth and protection redirects stay at `/dashboard`

Keep `/` → `/dashboard`; login/register `redirectTo` and form fallbacks → `/dashboard`; `RedirectIfAuthed` → `/dashboard`; unauthenticated `ProtectedRoute` → `/login`; logout, `check`, and `onError` → `/login`. Do not add a return-to query. **Rationale:** `/dashboard` is the canonical authenticated home before and after the change and now shows the placeholder; pointing login at `/tasks` would make Tasks the de facto home and contradict the requirement. Auth semantics are unchanged. Consequence: login lands on `/dashboard`, so every e2e test that needs a table must click its nav link first.

### 3.8 Loader keys follow the new paths

`routeLoaders` keys become `/dashboard`, `/tasks`, `/users`, and `/settings`; add `apps/web/src/routes/dashboard.tsx`; keep `/login` and `/register`; add no key for a legacy path. **Rationale:** `LazyRoute` indexes the map by the rendered path and `IntentLink` prefetches by `to`; a mismatched key silently disables prefetch or loads the wrong chunk. Legacy paths render only a redirect, so their loaders would be dead code. The placeholder needs a loader so the breadcrumb root and brand links can warm it on intent, preserving the "nothing at startup or idle" contract.

### 3.9 Perf route key becomes `/tasks`

Rename `perf-budgets.json`'s `/dashboard/tasks` key to `/tasks` and keep `560228` JS / `14875` CSS. Do not add a `/dashboard` budget. Update `scripts/perf/run.mjs` `ROUTES`, `lighthouserc.cjs` default URL/comments, `scripts/perf/login.cjs`'s authenticated-route predicate, `scripts/perf/budget.mjs`'s example comment, the `lhr-tasks-*.json` URLs, and the two perf unit tests. **Rationale:** `routeFromUrl` keys a report by the requested pathname, so the harness must audit `/tasks` directly; auditing `/dashboard/tasks` would file the report under the old key and fail the lookup. Bundle contents do not change, so ceilings must not move. The placeholder is not a third audited route: it has no data and its chunk is isolated. The only measured cost is one extra `routeLoaders` entry in the eager closure (tens of bytes), inside the existing headroom (≈6.3 KB on `/tasks`, >11 KB on `/login`); if a measurement breaches, shrink the placeholder, never raise a ceiling. The login step seeds `/dashboard`, `/tasks`, `/users`, and `/settings` only; `/login` and `/register` stay anonymous.

### 3.10 Update live docs, preserve history

Update `apps/web/README.md`'s routing table/prose and the live `/tasks` references in `docs/features/performance.md` (§5 and §7), `docs/features/error-boundaries.md:118`, `docs/features/logging-and-monitoring.md:215-217`, and `docs/adr/0010-performance-measured-on-production-builds.md:14`; leave dated numbers intact with "measured as `/dashboard/tasks`". Leave `docs/features/migrate-to-shadcn.md` unchanged because component names stay, and leave `.agents/skills/**` and `apps/web/dist/**` unchanged. **Rationale:** current docs must name the route an implementer runs; historical measurements must not be silently restated. The README describes aliases in prose without listing the old subpaths, keeping the stale-path grep clean.

## 4. Implementation plan

### 4.1 Router, placeholder, loaders

`apps/web/src/App.tsx`:

```tsx
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard/tasks" element={<Navigate to="/tasks" replace />} />
  <Route path="/dashboard/users" element={<Navigate to="/users" replace />} />
  <Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />

  <Route element={<RedirectIfAuthed />}>
    {/* /login and /register LazyRoutes unchanged */}
  </Route>

  <Route element={<ProtectedRoute />}>
    <Route element={<DashboardLayout />}>
      <Route path="/dashboard" element={<LazyRoute path="/dashboard" fallback={null} />} />
      <Route path="/tasks" element={<LazyRoute path="/tasks" fallback={<TablePageSkeleton kind="tasks" />} />} />
      <Route path="/users" element={<LazyRoute path="/users" fallback={<TablePageSkeleton kind="users" />} />} />
      <Route path="/settings" element={<LazyRoute path="/settings" fallback={<SettingsPageSkeleton />} />} />
    </Route>
  </Route>
</Routes>
```

`apps/web/src/routes/dashboard.tsx` exports `DashboardPage`, which calls `useTranslation()` and renders `<main className="p-6"><h1 className="text-lg font-medium">{t("shell.title")}</h1></main>`. `apps/web/src/routes/route-loaders.ts` maps `/dashboard`, `/tasks`, `/users`, and `/settings` to `DashboardPage`, `TasksPage`, `UsersPage`, and `SettingsPage`; `/login` and `/register` stay, and the old `/dashboard/*` keys are removed, not aliased.

### 4.2 Shell and sidebar

`apps/web/src/components/dashboard-shell.tsx` replaces the segment block with:

```ts
const segments = (pathname ?? "").split("/").filter(Boolean)
const routeSegments = segments[0] === "dashboard" ? segments.slice(1) : segments
const crumbs = [
  { href: "/dashboard", label: t("shell.title"), isCurrent: pathname === "/dashboard" },
  ...routeSegments.map((segment, index) => ({
    href: `/${routeSegments.slice(0, index + 1).join("/")}`,
    label: t(SEGMENT_LABELS[segment] ?? segment),
    isCurrent: index === routeSegments.length - 1,
  })),
]
```

In `apps/web/src/components/app-sidebar.tsx`, set the three `url` values to `/tasks`, `/users`, `/settings`, the header `IntentLink` to `/dashboard`, and `isActive` to `pathname === item.url || pathname.startsWith(`${item.url}/`)`. Update comments in `apps/web/src/routes/dashboard-layout.tsx:9` and `apps/web/src/components/dashboard-shell.tsx:25,50,68`; `apps/web/src/components/page-skeletons.tsx:63` remains accurate.

### 4.3 Auth redirects

No value changes. Audit `apps/web/src/routes/protected-route.tsx:21,30`, `apps/web/src/providers/auth-provider.ts:122,148,153,163`, `apps/web/src/features/auth/components/login-form.tsx:48`, `apps/web/src/features/auth/components/register-form.tsx:50`, and `apps/web/src/components/app-sidebar.tsx:106`; every value is `/dashboard` or `/login` and remains correct (§3.7).

### 4.4 Unit tests

| File                                         | Change and assertion                                                                                                                                                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/intent-link.test.tsx`         | Sample link and all three prefetch expectations use `/settings`.                                                                                                                                                                                                |
| `apps/web/test/route-loaders.test.ts`        | Add `dashboard: 0`, mock `@/routes/dashboard`, use `/tasks` in prefetch/key tests; assert prefetching `/tasks` loads only Tasks; add one regression that `prefetchRoute("/dashboard/tasks")` resolves `undefined` and loads nothing (allowed legacy-path test). |
| `apps/web/test/observability-logger.test.ts` | Navigate to `/tasks?secret=hunter2#frag`; assert `context.path === "/tasks"` and the secrets stay absent.                                                                                                                                                       |
| `apps/web/test/auth-provider.test.ts`        | No change: `/dashboard` is still the landing route (lines 52, 136).                                                                                                                                                                                             |
| `apps/web/test/perf-budget.test.ts`          | Fixtures, summaries, budget keys, and `routeFromUrl` expectations become `/tasks`; the masked fixture is still rejected.                                                                                                                                        |
| `apps/web/test/perf-login.test.ts`           | Use `/tasks`; assert `/dashboard`, `/tasks`, `/users`, `/settings` seed and `/login`/`/register` do not.                                                                                                                                                        |

### 4.5 E2E tests

| File                                                                                               | Change and assertion                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/helpers.ts`                                                                          | Login waits for `/dashboard` exactly (`/\/dashboard$/`).                                                                                                                                                                            |
| `apps/web/e2e/auth.spec.ts`                                                                        | Register and login land on `/dashboard` exactly; the authenticated bounce from `/login` returns to `/dashboard`, not `/tasks`.                                                                                                      |
| `apps/web/e2e/sidebar.spec.ts`                                                                     | After login expect `/dashboard`; click Tasks before asserting the active item; assert `/tasks`, `/users`, `/settings` for navigation; after collapse + reload expect `/dashboard`; assert the breadcrumb reads "Dashboard > Tasks". |
| `apps/web/e2e/tasks.spec.ts`, `tasks-a11y.spec.ts`, `tasks-filters.spec.ts`, `tasks-write.spec.ts` | Login still waits for `/dashboard`; `openTasks` expects `/tasks` and clicks Tasks before waiting for the table.                                                                                                                     |
| `apps/web/e2e/users.spec.ts`                                                                       | `openUsers` expects `/users`.                                                                                                                                                                                                       |
| `apps/web/e2e/settings.spec.ts`                                                                    | Replace all four `page.goto("/dashboard/settings")` calls with `/settings`.                                                                                                                                                         |
| `apps/web/e2e/chunk-failure.spec.ts`                                                               | `page.goto("/settings")`; shell/retry assertions unchanged.                                                                                                                                                                         |
| `apps/web/e2e/loading.spec.ts`                                                                     | After login on `/dashboard`, click Tasks before expecting the table; `page.goto("/settings")`; route-module regexes stay resource-named.                                                                                            |
| `apps/web/e2e/observability.spec.ts`                                                               | `openTasks` expects `/tasks`; the event's `context.path` is `/tasks`.                                                                                                                                                               |
| `apps/web/e2e/redirects.spec.ts` (new)                                                             | Authenticated: `/dashboard/tasks` → `/tasks` + table, `/dashboard/users` → `/users` + users table, `/dashboard/settings` → `/settings` + Settings heading; `/dashboard` stays `/dashboard` with the shell/breadcrumb, the Dashboard heading, and no table.  |

### 4.6 Performance config, fixtures, tests

| File                                                                         | Change                                                                                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/perf-budgets.json`                                                 | Key `/dashboard/tasks` → `/tasks`; keep `560228` / `14875`.                                                                                           |
| `apps/web/scripts/perf/run.mjs:20`                                           | `ROUTES = ["/login", "/tasks"]`.                                                                                                                      |
| `apps/web/lighthouserc.cjs:15,26,81`                                         | Default URL and comments use `/tasks`.                                                                                                                |
| `apps/web/scripts/perf/login.cjs:14,26,72`                                   | Replace `DASHBOARD_PREFIX` with `new Set(["/dashboard", "/tasks", "/users", "/settings"])`; seed only those; keep `/login` and `/register` anonymous. |
| `apps/web/scripts/perf/budget.mjs:44`                                        | Example comment uses `/tasks`.                                                                                                                        |
| `apps/web/test/fixtures/perf/lhr-tasks-run1-3.json`, `lhr-tasks-masked.json` | `requestedUrl`/`finalDisplayedUrl` become `http://localhost:4173/tasks`; keep file names.                                                             |

### 4.7 Docs

| File                                                                          | Change                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/README.md:36-43`                                                    | `/dashboard` is the placeholder; `/tasks`, `/users`, `/settings` are top-level; "`/dashboard/*` routes share…" becomes "Authenticated routes share…". Describe aliases without listing the old subpaths. |
| `docs/features/performance.md`                                                | §5 contract and §7 target/budget tables use `/tasks`; dated §2/§6 measurements keep numbers with "measured as `/dashboard/tasks`".                                                                       |
| `docs/features/error-boundaries.md:118`                                       | Budget reference → `/tasks`.                                                                                                                                                                             |
| `docs/features/logging-and-monitoring.md:215-217`                             | Current route label → `/tasks`, annotated "formerly `/dashboard/tasks`".                                                                                                                                 |
| `docs/adr/0010-performance-measured-on-production-builds.md:14`               | Route reference → `/tasks`.                                                                                                                                                                              |
| `GLOSSARY.md`                                                                 | Add **Dashboard**: the authenticated area of the application, so `DashboardPage`, `DashboardLayout`, and `DashboardShell` share one definition.                                                            |
| `docs/adr/0014-flat-authenticated-routes.md`                                  | New: records the flat URL contract, the placeholder home, the client-side aliases, and the deliberate drop of query/hash.                                                                                 |
| `docs/features/migrate-to-shadcn.md`, `.agents/skills/**`, `apps/web/dist/**` | No change: retained names, vendor examples, generated output.                                                                                                                                            |

## 5. Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm perf
```

The change is complete when all pass and the stale-path grep is clean outside redirects and redirect tests:

```bash
rg -n '/dashboard/(tasks|users|settings)' \
  apps/web/src apps/web/test apps/web/e2e apps/web/scripts \
  apps/web/perf-budgets.json apps/web/lighthouserc.cjs \
  --glob '!**/dist/**'
```

Expected hits only: the three `<Navigate>` entries in `apps/web/src/App.tsx`, the legacy URLs in the new `apps/web/e2e/redirects.spec.ts`, and the single legacy-path regression in `apps/web/test/route-loaders.test.ts`. Any other hit is stale. Separately, `rg -n '/dashboard/tasks' apps/web/perf-budgets.json apps/web/scripts apps/web/test/fixtures` must return nothing. The appendix's old paths are the preserved requirement, outside this grep.

Proof: `pnpm typecheck` proves the `RoutePath` union, loader keys, and every `LazyRoute path` agree; `pnpm test` proves the old keys are gone, perf fixtures/budget use `/tasks`, the seeder's set is correct, and `IntentLink` prefetches `/settings`; `pnpm test:e2e` proves aliases reach the new pages, `/dashboard` stays put with the shell, login lands on the placeholder, and sidebar/breadcrumb highlight the new routes; `pnpm perf` prints `/tasks` and passes both byte budgets; `pnpm lint` proves no stale imports remain.

## 6. Future work

- Add a catch-all 404 if the product wants a designed unknown-URL surface; this change deliberately redirects.
- Preserve query strings/hashes on the aliases; table filters are URL state, so legacy bookmarks currently lose their view.
- Add return-to-after-login as a separate auth UX change.
- Rename `DashboardLayout`/`DashboardShell` to `AppLayout`/`AppShell` if the product stops calling the authenticated area a dashboard.
- Add a `/dashboard` byte budget if the placeholder grows real content.

## Appendix A — Original requirement (verbatim)

- new `/dashboard` = empty placeholder page
- `/dashboard/tasks` → `/tasks`
- `/dashboard/users` → `/users`
- `/dashboard/settings` → `/settings`
- update all internal links and redirects that point to the old paths
