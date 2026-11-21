# Live Dashboard updates over SSE through a custom LiveProvider

**Status**: accepted

The Dashboard must reflect Task changes without a page reload, and `@refinedev/simple-rest` ships no `liveProvider` — its data provider is request/response only. We implement a custom `LiveProvider` on the platform `EventSource` API against a server-sent-events endpoint, and the Dashboard consumes it through Refine's `useSubscription` hook. The stream carries **Live events** (channel, change type, ids), not Business events, and the client treats each event as an invalidation signal: it refetches the **Task summary** from the authoritative aggregate endpoint rather than patching charts from payload deltas. This keeps one source of truth for the counts and matches Refine's resource-invalidation model.

## Considered Options

- **Poll the summary endpoint**: simplest and backend-agnostic, but every client pays a fixed request rate and the "live" requirement is not met.
- **Use a hosted provider (Ably, Supabase, Hasura)**: the only `liveProvider`s Refine ships, but they add an external service and credentials this template does not have.
- **Native `EventSource` with a bearer token in the query string** (chosen): `EventSource` cannot set an `Authorization` header, so the access token is passed as `access_token`; the mock validates it and the event payload carries only channel/type/ids. A real backend can replace this with an httpOnly cookie or a short-lived stream token without changing the Refine boundary.
- **Fetch-based SSE with the bearer header**: correct header semantics, but requires a hand-written stream parser and reconnect logic, and MSW's `sse()` helper only intercepts native `EventSource`.
- **WebSocket**: bidirectional capability the Dashboard does not need, and a different server contract.
- **Client-side `publish` on the LiveProvider**: would make same-tab mutations appear live, but duplicates the server's event source and would not represent another client's changes. The provider therefore omits `publish`; the server is the only publisher.

## Consequences

- `useSubscription`'s effect depends only on `[enabled]`, so the Dashboard callback is held in a ref; changing the channel or callback does not silently resubscribe.
- Live events are channel- and type-filtered inside the provider. Core invalidates resource-wide, so the Dashboard invalidates its own summary query explicitly, coalesced to at most one refetch per 250 ms.
- The mock serves `/api/events` with MSW 3's `sse()` handler and publishes from the same mutation handlers that write the collections. The simulator that makes the demo visibly move is mock-only and disabled in real-backend mode.
- The in-browser mock cannot share events across tabs (`@msw/data`'s `persist()` writes on `visibilitychange` without a cross-tab subscription). Cross-client realtime is exercised against a real backend; the e2e test mutates in the same tab.
- MSW's `sse()` refuses to construct without a global `EventSource`, so the SSE handler is imported by the browser worker only and never by the Node API smoke-test handler set.
- Tokens in query strings can appear in server logs. The event payload is deliberately non-sensitive, and the ADR records the cookie/stream-token alternative for a production backend.
- Recharts pushes the Dashboard route past its old byte budget, and the vendored `card`/`chart` classes push the shared stylesheet past its 15,000 B ceiling. Both budgets are re-ratcheted from the measured production build (Dashboard JS 377,345 B, shared CSS 16,000 B) rather than dropping the feature or its components.
