# Performance is measured on production preview builds

Performance is judged from a production build served by `vite preview`, audited with Lighthouse mobile emulation in a cold browser context, and enforced as lab budgets in CI. The Vite dev server is excluded as evidence: it serves every module individually (196 requests, 10.8 MB unminified) and produced a 0.55 score against a 559 KB gzip production chunk, so a dev-server audit measures the module graph rather than the user experience.

## Considered Options

- **Audit the dev server manually** (the previous approach): fast to start, but the numbers describe Vite's module serving and cannot gate a release. Rejected.
- **Real-user monitoring only**: measures actual users, but needs a telemetry vendor and backend this template does not have. Deferred; the lab contract is a prerequisite either way.
- **Desktop, unthrottled Lighthouse** (the previous report's profile): flatters the app and misses the mobile conditions Core Web Vitals are defined for. Rejected.

## Consequences

- Budgets are derived from the built artifact, not from source estimates.
- CI builds and previews the app; byte budgets are blocking, and Lighthouse timing assertions block on the median of three runs.
- Dev-server Lighthouse JSON is never cited as a baseline.
