# Observability is console-first, vendor-neutral, and anonymous

**Status**: accepted

The app ships structured logging, field Web Vitals, and business events with no telemetry vendor and no network transport: every entry goes to the console through one injectable sink, and `web-vitals` — the only correctness dependency — supplies LCP, CLS, and INP. A starter template that ships a phantom observability backend or a vendor SDK imposes a data processor, credentials, a CSP/CORS surface, and bundle bytes on every user; an anonymous **Analytics session** plus pathname-only context gives the same debugging value without collecting identity or requiring consent. The existing `reportError` seam is absorbed into the same logger, so ADR-0012's "single place a future vendor plugs in" remains true without a second seam.

## Considered Options

- **Adopt a vendor SDK (Sentry/DataDog/PostHog)**: real production monitoring, but adds lock-in, credentials, third-party egress, and bundle weight against a 560,228 B tasks-route ceiling. Rejected for a template that ships no production backend.
- **Buffer and flush to an HTTP endpoint**: the sketch's batching has no endpoint to flush to and would require flush-on-unload, retry, a drop policy, and CSP/CORS handling. Deferred until a real backend exists; it then implements `LogSink`.
- **Auth-linked session id**: correlates entries with a User, but turns debugging data into personal data and couples an anonymous analytics concept to token rotation. Rejected.
- **Hand-rolled `PerformanceObserver`**: CLS session windows and INP are not reasonably reimplemented, and native entries carry no rating. Rejected; `web-vitals` is a correctness dependency, not a convenience one.
- **Full-URL context**: query strings carry user-entered filter and search state. Rejected in favour of pathname only.

## Consequences

- The default sink is the console in every environment. There is no buffer, batch, or flush; a future vendor implements `LogSink` and calls `setSink`.
- Field LCP/CLS/INP now exist, so the earlier "stays lab-only" non-goal is amended rather than silently contradicted. The lab harness remains the measurement contract.
- Caught render errors route through `onCaughtError → reportError`, superseding ADR-0012's "leave React's default" behaviour; the root boundary still has no `onError`, so an error is reported once.
- Business events are product telemetry, distinct from Refine's audit log (a durable who-changed-what record). The audit provider stays a stub.
- Entries stay anonymous, but they still carry task ids and enum values. Call sites must keep names, emails, titles, and free text out of `data`.
