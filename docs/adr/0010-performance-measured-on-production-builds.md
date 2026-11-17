# Performance is measured on production preview builds

Performance is judged from a production build served by `vite preview`, audited with Lighthouse mobile emulation in a cold browser context, and enforced as lab budgets in CI. The Vite dev server is excluded as evidence: it serves every module individually (196 requests, 10.8 MB unminified) and produced a 0.55 score against a 559 KB gzip production chunk, so a dev-server audit measures the module graph rather than the user experience.

## Considered Options

- **Audit the dev server manually** (the previous approach): fast to start, but the numbers describe Vite's module serving and cannot gate a release. Rejected.
- **Real-user monitoring only**: measures actual users, but needs a telemetry vendor and backend this template does not have. Deferred; the lab contract is a prerequisite either way.
- **Desktop, unthrottled Lighthouse** (the previous report's profile): flatters the app and misses the mobile conditions Core Web Vitals are defined for. Rejected.

## Consequences

- Budgets are derived from the built artifact, not from source estimates.
- CI builds and previews the app; byte budgets are blocking on the median of three runs, as is CLS. TBT, score, and LCP publish the median and warn, but are report-only: TBT because shared-runner timing is unstable (608–640 ms on the GitHub runner versus 127–141 ms locally), and score/LCP because `/tasks` does not yet meet the target. TBT returns to blocking on a stable measurement host; score/LCP return to blocking (`warn` → `error`) after [#35](https://github.com/phuclecong/template-reactjs/issues/35) meets the thresholds. The target is never declared met while the warnings remain.
- The authenticated route's session is injected directly into the audited tab (`evaluateOnNewDocument`), never created by loading the app and logging in first. That keeps the context cold: no service worker and no `localStorage` seed exist before the audit, and the request-time worker bytes are measured honestly. Reports with header-only `Script`/`Stylesheet` transfers are rejected as masked.
- CI also builds the real-backend mode (`VITE_API_URL` set) and blocks if that artifact contains an MSW chunk or preload.
- Dev-server Lighthouse JSON is never cited as a baseline.
