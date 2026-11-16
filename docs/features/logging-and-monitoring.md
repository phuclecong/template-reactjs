# Logging and monitoring

**Status**: accepted
**Tracking**: spec [#46](https://github.com/phuclecong/template-reactjs/issues/46)
**Decision records**: `docs/adr/0013-console-first-observability.md`, `docs/adr/0012-error-containment-render-only.md`
**Related**: `docs/features/error-boundaries.md`, `docs/features/performance.md`, `docs/features/requirement.md`

## 1. Summary

The app emits structured observability entries from three sources — explicit logs, field Web Vitals, and business events — through one module and one sink. Every entry carries module-owned context (analytics session, pathname, user agent, environment) plus only the data a call site explicitly supplies. In this template the sink is the console: there is no vendor, no network request, no batching, and no retention. `reportError` becomes a thin error-shaped wrapper over the same logger, so uncaught errors, unhandled rejections, and caught render errors land in one stream.

The layer is deliberately anonymous and vendor-neutral. An **Analytics session** is a random per-tab identifier, not the Auth session; entries log `pathname`, never the query string; and business events carry ids and enums, never names or free text. Field metrics use `web-vitals` for LCP, CLS, and INP — the one dependency the design accepts.

## 2. Scope

### In scope

- New `apps/web/src/observability/` module:
  - `session.ts` — Analytics session id.
  - `logger.ts` — entry types, safe serializer, console sink, `log`, `setSink`.
  - `events.ts` — `track`.
  - `web-vitals.ts` — `installWebVitals`.
  - `error-reporting.ts` — moved from `apps/web/src/utils/`, now delegating to the logger.
  - `index.ts` — the module's public surface.
- `main.tsx`: install the rejection reporter and `installWebVitals()`, and route `onUncaughtError` and `onCaughtError` through `reportError`.
- Business events at `task.created`, `task.updated`, `task.deleted`, and `task.bulk_action`.
- Unit tests, one Playwright console assertion, ADR-0013, and the ADR-0012 / `error-boundaries.md` / `performance.md` amendments.

### Out of scope

- A telemetry vendor, HTTP transport, batching, flushing, retry, offline buffering, and sampling.
- Auth/login events, page-view tracking, and session replay.
- User identity and consent management.
- Server-side rendering.
- Audit-log persistence; Refine's `auditLogProvider` remains a stub.
- Source-map upload, stack symbolication, dashboards, and alerts.

## 3. Design decisions

### One module, one public surface

`apps/web/src/observability/index.ts` exports:

```ts
export type LogLevel = "debug" | "info" | "warn" | "error"
export type LogSink = (entry: Entry) => void

export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void
export function track(event: string, data?: Record<string, unknown>): void
export function setSink(sink?: LogSink): void
export function reportError(
  error: unknown,
  context?: { componentStack?: string }
): void
export function normalizeError(error: unknown): Error
export function installUnhandledRejectionReporter(
  target?: Pick<Window, "addEventListener">
): void
export function installWebVitals(): void
export function getAnalyticsSessionId(): string

export type { Context, LogEntry, MetricEntry, EventEntry, Entry }
```

`error-reporting.ts` moves into the module so ADR-0012's "single reporting seam" is physically single. Internals are not deep-imported.

### Entry shape

Entries are a discriminated union. `context` is module-owned; call-site data only ever lands in `data`.

```ts
type Context = {
  sessionId: string
  path: string
  userAgent: string
  env: "development" | "production" | "test"
}

type LogEntry = {
  timestamp: string // ISO 8601
  level: LogLevel
  kind: "log"
  message: string
  context: Context
  data?: Record<string, unknown>
}

type MetricEntry = {
  timestamp: string
  level: "info"
  kind: "metric"
  context: Context
  metric: {
    name: "LCP" | "CLS" | "INP"
    value: number
    rating: "good" | "needs-improvement" | "poor"
  }
}

type EventEntry = {
  timestamp: string
  level: "info"
  kind: "event"
  context: Context
  event: string
  data?: Record<string, unknown>
}

type Entry = LogEntry | MetricEntry | EventEntry
```

- `kind` replaces the sketch's message prefixes (`"Business: …"`, `"Web Vital: …"`), so consumers filter structurally.
- `context` is written after any call-site input; a caller cannot overwrite `sessionId`, `path`, `userAgent`, or `env`.
- `path` is `window.location.pathname`; the query string and hash are never read.
- `env` is `"test"` when `import.meta.env.MODE === "test"`, otherwise `"development"` when `import.meta.env.DEV`, otherwise `"production"`. This is a Vite app; `process.env` is not read in the browser.
- `timestamp` is an ISO string so a console entry stays readable when pasted into an issue. It is the client clock, not a trusted server time.

### Safe serialization

`data` passes through a serializer before it reaches the sink:

- `Error` becomes `{ name, message, stack }`.
- A circular reference becomes `"[Circular]"`.
- Functions and symbols are omitted.
- The result is `JSON.stringify`-safe; tests assert this rather than trusting a comment.

This is what keeps `log("error", …, { error })` from printing `{}`.

### The sink

```ts
type LogSink = (entry: Entry) => void
```

- One module-level sink, last-wins. `setSink()` restores the console sink, so a test or a future transport can replace it.
- The default console sink maps `debug`/`info`/`warn`/`error` to `console.debug`/`info`/`warn`/`error` and prints the entry object. There is no pretty-printer and no batch.
- A sink may start asynchronous work internally but must return `void`. If it throws, the logger swallows the exception: a broken transport must not break the app or recurse into logging.
- There is no buffer. `flush` and batching appear only when a real transport exists, at which point the transport is the sink.

### Analytics session

- Created lazily on the first entry with `crypto.randomUUID()`, with a timestamp/random fallback when `crypto.randomUUID` is unavailable.
- Stored in `sessionStorage` under `observability.session`, deliberately not `auth.session`. A new tab gets a new id; a reload keeps it; login and logout do not rotate it.
- If storage access throws, the id lives in module memory for the page lifetime.
- It is anonymous by construction: never derived from the access token, the refresh token, or the authenticated User, and entries carry no user id.

### Privacy

- Entries carry ids and enums. They must not carry names, emails, task titles, descriptions, search terms, or any other free text.
- The full URL is never logged; only `pathname`.
- No cookies are written and no entry leaves the browser, so the template does not require a consent banner. If a user wires a vendor sink, consent and retention become their decision, documented at the sink.

### Error reporting is the same seam

- `reportError(error, context?)` normalizes the value and emits `log("error", error.message, { error, componentStack? })`. Boundary tests that only assert the diagnostic fired keep passing; `error-reporting.test.ts` is updated to assert the structured entry, since the first console argument is now the entry rather than the raw `Error`.
- `installUnhandledRejectionReporter` keeps its current contract: it adds an `unhandledrejection` listener, never calls `preventDefault`, and accepts an injectable target for tests.
- `main.tsx` passes both `onUncaughtError` and `onCaughtError` to `createRoot` as `(error, info) => reportError(error, info)`. The root `ErrorBoundary` receives no `onError`, so a caught error is emitted once. Feature boundaries may pass `onError`, but that callback must not also call `reportError`.

### RUM via `web-vitals`

- `installWebVitals()` registers `onLCP`, `onCLS`, and `onINP` once from `main.tsx`, outside React, so StrictMode cannot double-register.
- Each callback emits a metric entry with the metric's value and rating. The callbacks fire when `web-vitals` finalizes the metric, including on page hide; the app adds no `pagehide` handler of its own.
- Only the three callbacks are imported, not the package's full entry point, to limit bundle cost.
- FCP, TTFB, and the retired FID are not reported. INP replaces FID as the responsiveness metric.

### Business events

- `track(event, data?)` emits an `EventEntry`. Event names use `entity.action` in the past tense.
- The first cut instruments four events at their real success points:
  - `task.created` — the create mutation's success callback in `task-dialogs.tsx`.
  - `task.updated` — the update mutation's success callback.
  - `task.deleted` — the delete mutation's success callback.
  - `task.bulk_action` — `use-task-bulk-actions.ts`, with `{ action: "status" | "priority" | "assignee" | "due_date", selected, updated, failed }`.
- Failures stay on their existing paths: errors through `reportError`, user feedback through Refine's notification provider. A Business event records a completed action, not an attempt.
- Refine's `auditLogProvider` is not a tracking sink. An Audit log is a durable who-changed-what record; a Business event is aggregate product telemetry. The stub stays untouched.

### Environment behaviour

- The console sink runs in development, test, and production. Tests spy on `console` exactly as the boundary tests already do.
- `debug` entries are dropped outside development; `info`, `warn`, and `error` are always emitted.
- The logger must not read `window` or `navigator` at module load: Vitest runs in the Node environment by default. Context reads happen per entry with a non-browser fallback.

## 4. What is not logged

- No user identity, tokens, names, emails, or free text.
- No query strings, fragments, referrers, or cookies.
- No request or response bodies.
- No event-handler attempts, validation failures, or toast messages — those have their own surfaces.
- No retries, sampling, or offline buffering; every entry is emitted once, synchronously.

## 5. Verification

- Unit tests (default Node environment; jsdom where browser APIs are exercised):
  - Session: creates and persists `observability.session`, reuses it, falls back when storage throws, and never touches `auth.session`.
  - Logger: entry shape for each `kind`; `path` excludes the query string; `debug` is dropped outside development; `data` cannot overwrite `context`; Errors and circular values serialize safely; a sink receives entries; a throwing sink is isolated; `setSink()` restores the console sink.
  - Events: `track` emits an `EventEntry` with the event name and data.
  - Web Vitals: `vi.mock("web-vitals")` captures the registered callbacks and asserts each emits one metric entry; no custom page-hide handler is added.
  - Error reporting: `error-reporting.test.ts` is updated to assert the entry shape produced by `reportError`; the first console argument is the entry, not the raw `Error`.
- One Playwright spec captures `page.on("console")` while creating or bulk-updating a task and asserts a `kind: "event"` entry. RUM is not asserted in e2e: its timing is machine-dependent.
- `pnpm perf` keeps both routes inside their byte ceilings (Section 6). The measured delta is recorded in this document.
- Manual check: in `pnpm dev`, `log`, `track`, and a Web Vital produce readable console entries; reload preserves the analytics session; a new tab gets a new one.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `CI=1 pnpm --filter web test:e2e` pass.

## 6. Performance

The logger is in the initial closure because `main.tsx` already imports `reportError`; `installWebVitals()` also runs there. Current ceilings and honest medians:

| Route              | JS ceiling | JS median | Headroom |
| ------------------ | ---------- | --------- | -------- |
| `/login`           | 315,333 B  | 304,255 B | 11,078 B |
| `/dashboard/tasks` | 560,228 B  | 540,756 B | 19,472 B |

Measured on 2026-11-16 with `pnpm perf` (three cold runs per route), on this branch and, for the ratio, on a clean worktree at the branch point `dda12e1`: `/login` JS 300,650 B → 304,255 B (+3,605 B), `/dashboard/tasks` JS 537,034 B → 540,756 B (+3,722 B), CSS 14,869 B on both routes (+0 B). The ~3.7 KB is the logger (entry construction, safe serializer, session and context reads) plus the three `web-vitals` callbacks, all in the initial closure. It fits both ceilings without loosening either. The branch-point medians differ from `performance.md` §2's 2026-11-14 baseline because that measurement predates merged changes after it; the worktree pair is the like-for-like delta.

CSS measures 14,869 B on both routes, unchanged, against the 14,875 B ceiling. The ratchet rule and the "fix a red route, never loosen a ceiling" policy from `performance.md` §5 apply unchanged. If the feature exceeds the tasks-route headroom, shrink it — import only the three `web-vitals` callbacks, or move non-essential business-event call sites into deferred chunks — rather than editing the budget. Changing the policy is a separate decision under ADR-0010, not a logging change.

`performance.md` §4 previously deferred field INP "once telemetry exists". This feature is that telemetry, so the non-goal is amended to "no RUM vendor": field vitals are logged locally and no third party receives them.

## 7. Future work

- A vendor or HTTP transport implements `LogSink` and calls `setSink`; if it needs batching, that sink owns flush-on-page-hide, `keepalive`, retry, and a drop policy, along with its own consent and retention rules.
- Sampling or rate limiting becomes necessary only once entries leave the browser.
- Auth events (login success/failure) need a security decision before they ride on this layer.
- A typed business-event catalogue, if the event list grows beyond a handful.
- Audit-log persistence remains separate from Business events.
- Source maps and stack symbolication, if a vendor sink is added.
