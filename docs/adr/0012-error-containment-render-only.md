# Error containment is render-only and in-repo

**Status**: accepted

Render-time failures are contained by one dependency-free `ErrorBoundary` class in `apps/web/src/components`, not by `react-error-boundary`, and the boundary deliberately does not attempt to forward async or event-handler errors. React routes only render, lifecycle, and constructor errors to boundaries; a hook claiming to handle a promise rejection must either rethrow (which no boundary sees) or write the error into a boundary through context, which replaces the failed surface with a fallback where the app's notification provider already gives better feedback. The repo already ships a dependency-free chunk boundary, and the generic boundary needs only `children`, `fallback`, `onError`, and `onReset` — a library would add dependency and API surface without removing meaningful work.

## Considered Options

- **Adopt `react-error-boundary` (v6)**: React 19-compatible and provides `resetKeys`/`fallbackRender`, but we use none of the features we cannot write in a small class, and its async escape hatch (`useErrorBoundary().showBoundary`) is not a React API and still requires consumers to sit inside a boundary. Rejected.
- **Keep `ChunkErrorBoundary` and add a separate generic boundary**: two class implementations with divergent reset behavior and two test stories. Rejected; the chunk boundary becomes a preset over the generic one.
- **Ship an async `useErrorHandler`**: cannot catch event-handler or promise errors at the boundary and produces a whole-surface fallback where a toast is the right affordance. Rejected.
- **Ship `resetKeys` speculatively**: no caller exists; routes remount by key and the chunk preset resets manually. Deferred until a feature boundary needs it.

## Consequences

- Async and event-handler failures stay on Refine's notification/toast path. `reportError` plus a `unhandledrejection` listener is the single seam for uncaught and unhandled failures.
- The root boundary sits in `main.tsx` outside every provider, so it catches provider failures but its fallback must remain provider-free.
- `ChunkErrorBoundary` is now a preset over the shared boundary; the chunk retry contract and measurements in `performance.md` are unchanged.
- Adding `resetKeys` or a boundary-aware async hook requires revisiting this ADR.
