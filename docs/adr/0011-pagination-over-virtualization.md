# Tabular data paginates; lists are not virtualized

**Status**: superseded by ADR-0020 (2026-11-21). The pagination contract below
still holds; the "not virtualized" half does not. See
`docs/adr/0020-tables-fit-viewport-and-virtualize.md`.

Task and User tables fetch one page at a time (10–100 rows, URL-driven `page`/`pageSize`) and render only that page; virtualization is deliberately not used. Pagination already bounds the DOM and preserves the search/filter/sort URL contract, while virtualizing a paginated table would add scroll-position and row-measurement complexity for no measurable benefit on 150 seeded tasks.

## Considered Options

- **Virtualize the paginated tables**: no DOM reduction beyond the page already provides, and it conflicts with the table's URL state and selection model. Rejected.
- **Infinite scroll with virtualization**: the opposite of the existing pagination contract, and the Tasks table contract already removed infinite scroll. Rejected.
- **Remove `@tanstack/react-virtual` immediately**: it is currently unused and tree-shaken out of the bundle. Left installed for now; removing it is a cleanup decision, not a performance one.

## Consequences

- The product requirement no longer asks for virtualization; memoization is profile-driven.
- A future view that renders an unbounded client-side list must revisit this ADR rather than silently adding virtualization.
