# Flat authenticated routes with client-side legacy aliases

**Status**: accepted

The authenticated pages live at top-level paths — `/tasks`, `/users`, `/settings` — instead of under `/dashboard`, so links point at the page rather than at a nesting level the app no longer uses. `/dashboard` remains the canonical authenticated home but renders a heading-only placeholder: the requirement makes it the post-login destination, and handing that role to `/tasks` would make Tasks the de facto home. Every old `/dashboard/*` URL stays mapped as a client-side `<Navigate replace>` alias outside the auth gate; a 404 would break bookmarks, and a static Vite SPA has no server rewrite or catch-all to fall back on. Query strings and hashes are deliberately not preserved: table state (search, filters, sort, pagination) is URL state, so a legacy bookmark can carry a view, but no internal link emits a legacy URL with query state and a redirect wrapper is not worth the surface for a transitional path.

## Consequences

- `/dashboard` is a lazy route inside the same shell as the other authenticated pages, so the placeholder costs its own chunk rather than bytes on `/login` or `/tasks`.
- `DashboardLayout` and `DashboardShell` keep their names: **Dashboard** names the authenticated surface (see `GLOSSARY.md`), not the `/dashboard` prefix.
- A catch-all 404, HTTP redirects, or query/hash preservation require revisiting this ADR.
