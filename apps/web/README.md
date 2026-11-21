# `web` — the Refine + React Router app

The user-facing app: an authenticated dashboard with Tasks, Users, and Settings
pages. Domain-specific code (Tasks, Users, auth, settings) lives here. It may
import from the three workspace packages, but never the reverse:

| Package                 | What it owns                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@workspace/ui`         | Presentational primitives (Button, Dialog, Field, Sidebar, …)                                                                                                                                                                     |
| `@workspace/shared-lib` | Shared table and write infra: React Router-coupled `useTableShell`, `createTableUrlAdapter`, the bulk-action lifecycle (`useBulkActions`, `useClearIntent`), table parts. It has no domain knowledge and never imports `apps/web` |
| `@workspace/api`        | The OpenAPI contract, zod schemas, and the MSW-backed mock API                                                                                                                                                                    |

## Stack

React Router 7 · React 19 · Vite · [Refine](https://refine.dev) (the single
data/auth backbone) · TanStack Query / Table · react-hook-form + zod · i18next
(en/vi) · MSW (mock API) · Tailwind / shadcn.

## Layout

| Directory         | What lives there                                                                      |
| ----------------- | ------------------------------------------------------------------------------------- |
| `src/`            | Entry (`main.tsx`), the `App` router tree, and the `providers` tree                   |
| `src/routes/`     | Route components, the auth guard, and the app-shell layout                            |
| `src/components/` | Cross-cutting app shell — `AppShell`, `AppSidebar`, theme/MSW gates                   |
| `src/features/`   | Vertical slices per resource (`dashboard/`, `tasks/`, `users/`, `auth/`, `settings/`) |
| `src/providers/`  | Refine providers — data, live, auth, access-control, i18n, notifications, audit       |
| `src/utils/`      | Auth transport, i18n engine, HTTP error/currency helpers                              |
| `test/`           | Vitest unit tests, one per provider/utility                                           |
| `e2e/`            | Playwright specs and shared helpers                                                   |

## Routing

| Route                 | Renders                                               |
| --------------------- | ----------------------------------------------------- |
| `/`                   | Redirects to `/dashboard`                             |
| `/login`, `/register` | Auth forms (`features/auth`)                          |
| `/dashboard`          | `DashboardView` — live Task summary (`DashboardPage`) |
| `/tasks`              | `TasksView` (fullest table example)                   |
| `/users`              | `UsersView` (minimal table example)                   |
| `/settings`           | `SettingsView` (theme, locale, currency, password)    |

Authenticated routes share `src/routes/app-shell-layout.tsx`, which renders the
sidebar + app shell around the routed page. A `<ProtectedRoute>` guard bounces
unauthenticated visitors to `/login`, and `<RedirectIfAuthed>` bounces
authenticated visitors away from the auth pages. The previous nested URLs remain
available as client-side aliases that redirect to the top-level paths.

## Feature folders

Each user-facing feature is a vertical slice under `features/<feature>/`
(ADR-0006): an `index.tsx` view as the public entry, with `components/`,
`hooks/`, and `utils/` added only where needed. A feature's view, table,
filters, hooks, and local domain types change together, so they live together.

| Feature     | Shape                                                         |
| ----------- | ------------------------------------------------------------- |
| `dashboard` | Live KPI cards + Recharts charts over the Task summary        |
| `tasks`     | Fullest — filters, selection, bulk actions, dialogs, row hook |
| `users`     | Minimal — one filter, inline `useList`, no selection          |
| `auth`      | `LoginForm` / `RegisterForm` (inline forms, no dialogs)       |
| `settings`  | Inline forms + theme/locale controls, no table                |

New resources follow the same recipe — see the `create-table`, `create-form`,
and `create-dialog` skills in [`.claude/skills/`](../../.claude/skills/).

## Data and providers

Refine is the single backbone for cross-cutting concerns (ADR-0002); everything
is wired once in `src/providers/index.tsx` and pages fetch through Refine hooks
(`useList`, `useGetIdentity`, `useCustomMutation`, …).

| Provider                  | What it does                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `data-provider`           | `simple-rest` pointed at `VITE_API_URL` (or `/api` in mock mode); attaches the in-memory access token |
| `live-provider`           | Custom SSE LiveProvider (`EventSource`) that feeds Refine's `useSubscription` (ADR-0020)              |
| `auth-provider`           | Login/register/logout via the auth transport; in-memory token + user                                  |
| `access-control-provider` | Admin/member matrix: admin = all; member = list users, act on own tasks                               |
| `notification-provider`   | Refine's notification bus → sonner toasts                                                             |
| `i18n-provider`           | Delegates to the shared i18next engine (ADR-0004)                                                     |
| `audit-log-provider`      | Stub with a real interface; echoes writes, no persistence yet                                         |

**Mock vs. real backend.** With `VITE_API_URL` unset, the app runs fully against
an in-browser MSW worker (started on the first `/api` request by
`src/utils/mock-worker.ts`, which dynamically imports `src/utils/msw.ts`). Set
`VITE_API_URL` and the app calls the real backend at that origin directly (CORS
must be enabled on the backend).

**Live updates.** The Dashboard subscribes to `resources/tasks` through the
custom SSE provider (ADR-0020); a Task write publishes an event and the
Dashboard refetches its summary. In mock mode MSW's `sse()` handler serves
`/api/events` from a simulated activity loop, so the charts move without a
second client. Set `VITE_MOCK_LIVE_ACTIVITY=false` to disable that loop (the
Playwright suite does this and drives the mutation itself). The `/api/events`
stream authenticates with an `access_token` query parameter because native
`EventSource` cannot set headers; a real backend may prefer a cookie or a
short-lived stream token.

## Auth

Client-side auth (ADR-0003): login/register call the auth transport and hold the
access token in memory — never `localStorage`. There is no server, so there is
no httpOnly cookie; reloading the app drops the token and sends the user back to
`/login`.

- **`src/providers/auth-provider.ts`** calls `utils/auth-client.ts` and holds the
  token/user in memory.
- **`src/routes/protected-route.tsx`** gates navigation.

## i18n

Client-side i18next (ADR-0004), resolved without a URL segment. Dictionaries
live in `utils/translations/en.ts` and `vi.ts`; `vi` is typed
`Translation = typeof en`, so the two must share every key — drift fails
typecheck. Add both whenever you add user-facing strings.

## Commands

Run from the repo root with `--filter`:

| Command                       | What it does                |
| ----------------------------- | --------------------------- |
| `pnpm --filter web dev`       | Start the Vite dev server   |
| `pnpm --filter web build`     | Production build            |
| `pnpm --filter web typecheck` | `tsc --noEmit`              |
| `pnpm --filter web lint`      | ESLint                      |
| `pnpm --filter web format`    | Prettier                    |
| `pnpm --filter web test`      | Vitest unit tests           |
| `pnpm --filter web test:e2e`  | Playwright end-to-end tests |
