# Error boundaries

**Status**: accepted
**Tracking**: spec [#43](https://github.com/phuclecong/template-reactjs/issues/43)
**Decision records**: `docs/adr/0012-error-containment-render-only.md`
**Related**: `docs/features/performance.md`, `docs/features/requirement.md`

## 1. Summary

A render-time exception should not blank the app. One dependency-free `ErrorBoundary` catches errors thrown during rendering, in lifecycle methods, and in constructors; it renders translated fallback copy with a retry action and keeps the rest of the tree interactive. A root boundary wraps the whole app in `main.tsx`, and every route view is already inside a boundary because `RetryableLazy` uses the chunk preset. Uncaught errors and unhandled promise rejections pass through one reporting seam.

The boundary is deliberately **render-only**. React does not route event-handler or async errors to boundaries, and failed mutations already surface through Refine's notification provider as toasts. There is no `useErrorHandler`, no `resetKeys`, and no new dependency.

## 2. Scope

### In scope

- `ErrorBoundary` in `apps/web/src/components/error-boundary.tsx`.
- A root boundary around `<App />` in `main.tsx`, inside `StrictMode`.
- `ChunkErrorBoundary` becomes a preset over `ErrorBoundary`; `RetryableLazy` keeps the fresh-lazy-identity retry.
- `apps/web/src/utils/error-reporting.ts`: `normalizeError`, `reportError`, and `installUnhandledRejectionReporter`, wired in `main.tsx`.
- Unit tests, ADR-0012, the `performance.md` cross-link, and the correction to `performance.md` §6.4.

### Out of scope

- Forwarding event-handler or async errors to a boundary.
- `resetKeys`.
- Feature-level widget boundaries until a real consumer exists.
- A telemetry vendor; `reportError` is the seam.
- Server-side rendering.
- New dependencies.

## 3. Design decisions

### One boundary implementation

`ErrorBoundary` is a class component because React has no hook equivalent. Its public surface:

```ts
type ErrorBoundaryProps = {
  children: ReactNode
  fallback?:
    | ReactNode
    | ((props: { error: Error; reset: () => void }) => ReactNode)
  onError?: (error: Error, info: ErrorInfo) => void
  onReset?: () => void
}
```

- An omitted `fallback` renders the existing translated UI — `error.title`, `error.body`, and an outline **Try again** button inside `role="alert"` — reusing the current `ChunkErrorFallback` markup so the render-blocking stylesheet budget does not move.
- A thrown value that is not an `Error` is normalized in `getDerivedStateFromError` (`error instanceof Error ? error : new Error(String(error))`), so both `fallback` and `onError` receive an `Error`.
- `onError(error, info)` fires from `componentDidCatch` and is opt-in; it is the per-boundary logging/telemetry hook.
- Reset happens through the fallback's `reset` or the default **Try again** button. `onReset` fires on reset; it is what lets the chunk preset mint a fresh lazy identity.
- The default fallback does not render `error.message`; consumers who want the message use the function form.
- No `resetKeys` until a consumer needs reset on an entity change; routes already remount by `key`.

### Placement

- **Root**: `main.tsx` renders `StrictMode > ErrorBoundary > App`. It catches failures in `App`, `BrowserRouter`, `ThemeProvider`, `Providers` (Refine, QueryClient, auth), and everything below. Its fallback must render without any provider: the i18n instance is initialized at module load and `useTranslation` resolves it without `I18nextProvider`, and the button is presentational.
- **Route-level**: every route view is rendered through `RetryableLazy`, so its boundary catches any render error from the loaded route, not only a rejected dynamic import. The sidebar and shell stay mounted, so navigation remains usable.
- **Feature-level**: none today. Wrap an independent widget only when it has its own remote data or failure surface. Do not wrap every component.

### Chunk retry stays a preset

`ChunkErrorBoundary` keeps its file, name, and `onRetry` prop, but becomes a thin function preset over `ErrorBoundary`:

```tsx
<ErrorBoundary onReset={onRetry}>{children}</ErrorBoundary>
```

The fresh `React.lazy` identity stays in `RetryableLazy`, because React caches a loader's rejection and resetting the boundary alone would replay it. The retry contract and measurements recorded in `performance.md` §6.4 are unchanged; only its "dependency-free class component" description is amended.

### Reporting

`apps/web/src/utils/error-reporting.ts` exposes:

```ts
type ErrorContext = { componentStack?: string }

export function normalizeError(error: unknown): Error
export function reportError(error: unknown, context?: ErrorContext): void
export function installUnhandledRejectionReporter(
  target: Pick<Window, "addEventListener"> = window
): void
```

`reportError` normalizes a non-`Error` reason and writes it to `console.error`; it is the single place a future telemetry vendor plugs in. `installUnhandledRejectionReporter` adds an `unhandledrejection` listener and must not call `preventDefault` — the browser's default reporting stays intact. The injectable target exists so tests do not leak a listener.

`main.tsx` installs the listener and passes `onUncaughtError: (error, info) => reportError(error, info)` to `createRoot`. `onCaughtError` is left at React's default so a caught render error is logged once and is not reported twice by boundary `onError`.

### Development behaviour

React 19 reports an error caught by a boundary once through `onCaughtError` (a consolidated `console.error`); it does not rethrow caught errors, and no DevTools overlay is part of the documented behaviour. We keep that default rather than suppressing it. Tests that intentionally crash a tree spy on `console.error` to keep the suite clean and assert the diagnostic fired.

## 4. What boundaries do not catch

Error boundaries do not catch:

- Event-handler errors.
- Async failures: promise rejections, `setTimeout`, `requestAnimationFrame`.
- Errors thrown inside the boundary's own fallback.
- Server-side rendering errors.

Where those failures go:

- **Mutations and data hooks** keep Refine's notification path; forms show inline validation.
- **Unhandled promise rejections** reach `installUnhandledRejectionReporter`.
- **Uncaught render errors outside any boundary** reach `onUncaughtError`.
- A rejected promise returned from a `useTransition` transition is the one async exception React routes to the nearest boundary; standalone async code is still invisible.

Event handlers and promises must not be wrapped in `try/catch` that rethrows, hoping a boundary will catch it — it will not.

## 5. Verification

- `apps/web/test/error-boundary.test.tsx` covers: default translated fallback, node fallback, function fallback with reset recovery, `onError` receiving the caught error, `onReset` on reset, and normalization of a non-`Error` throw. The expected `console.error` is spied and asserted.
- The existing `chunk-error-boundary.test.tsx` and `RetryableLazy` tests remain the preset regression net. The route-404 Playwright spec remains the end-to-end recovery proof; no new e2e spec is added.
- `reportError` and the `unhandledrejection` wiring are unit-tested through the injected target.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm perf` pass. The `/dashboard/tasks` byte budget stays green; if the boundary pushes it over the 560,228 B ceiling, shrink the boundary rather than raise the budget.

## 6. Future work

- Add `resetKeys` when a feature boundary must reset on an entity or route change.
- Add a boundary-aware async hook only if a fallback, rather than a toast, is the right affordance for an async failure; revisit ADR-0012.
- Replace `reportError`'s console sink with a telemetry vendor.
