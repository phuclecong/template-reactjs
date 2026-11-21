# Tables fit the viewport and virtualize their rows

**Status**: accepted

ADR-0011 rejected virtualization because server pagination already bounded the
DOM: one page of 10–100 rows, rendered in a normal document-scrolling page. The
product requirement has changed. Every list screen (Roles, Tasks, Users) should
fit the viewport as a single frame — page title, filters, table, and pagination
visible at once — with the table body as the only vertical scroller. That
fixed-height body is exactly the condition virtualization needs, and it makes
a 100-row page a normal case rather than an outlier. `@tanstack/react-virtual`
was already installed but unused, so the reversal adds no new dependency to the
workspace.

The reversal is deliberately narrow. Server pagination, the 10/30/50/100 page
sizes, the URL contract, and page-scoped selection all stay as they are. There
is no infinite scroll and no window-level virtualization. The virtualizer only
keeps the mounted row count proportional to the visible viewport inside the
table body.

ADR-0009 forbids editing vendored shadcn primitives, including
`packages/ui/src/components/table.tsx`, whose internal
`[data-slot="table-container"]` wrapper carries `overflow-x-auto`. A single
scroll container is composed around that wrapper with a `data-slot` variant
rather than by editing the primitive.

## Considered Options

- **Keep document scrolling and set a page-local `calc(100dvh - header)`**:
  leaves the app shell untouched, but hard-codes the 48px header height in
  every list page and lets the title and filters scroll away, which fails the
  "only the body scrolls" requirement. Rejected.
- **Edit the vendored `Table` primitive to own the scroll container**: the
  simplest markup, but it violates ADR-0009 and turns every future
  `shadcn add`/`diff` into a manual merge. Rejected.
- **Render the body as a div grid**: makes virtual positioning easy, but drops
  native table semantics (role, row/cell relationships, keyboard and screen
  reader behaviour) and would rewrite the accessible table surface. Rejected.
- **Use a fixed row height for every table**: cheapest virtualizer
  configuration, but the Users table renders a 32px `SelectTrigger` inside a
  `p-2` cell (~48px) while Roles and Tasks are text-only (~36px); one constant
  would mis-size at least one table. Rejected in favour of dynamic
  measurement with a 36px estimate.
- **Infinite scroll with window virtualization**: contradicts the pagination
  and URL contract, and `task-table.md` already removed infinite scroll.
  Rejected.
- **Fitted, body-scrolling, paginated tables with a virtualized body**:
  chosen.

## Decision

### Shell and page frame

- The authenticated shell owns the viewport height: `SidebarProvider` is
  `h-svh overflow-hidden`; the region below the 48px header is
  `flex min-h-0 flex-1 flex-col overflow-y-auto`. Non-table routes (Dashboard,
  Settings) scroll inside that region. `svh` is used instead of `dvh` so mobile
  browser chrome does not resize the shell during scroll.
- `TablePageLayout` in `packages/shared-lib/src/components/` owns the page
  contract for every list screen: `flex min-h-full flex-col gap-4 p-6 text-sm`.
  It is children-only; the feature keeps its title, filters, bulk bar, and
  overlays. Roles, Tasks, Users, and `TablePageSkeleton` all use it. It has a
  direct `exports` subpath because `page-skeletons.tsx` is in the entry chunk
  and must not pull the whole components index (ADR-0017).
- The grid region has a `240px` minimum. On a viewport too short to hold the
  title, filters, 240px grid, and footer, the shell content region scrolls and
  the grid scrolls internally; nested scrolling is accepted only in that
  fallback.

### Table shell

- `useTableShell` returns `stateKey`, the `locationSignature` it already
  computes from page, page size, filters, and sort.
- `TableShellView` owns the fitted column: a root of
  `flex min-h-0 flex-1 flex-col gap-4` in every branch, the grid region at
  `flex-1 min-h-[240px]`, and pagination at `shrink-0`. Loading, error, and
  empty states fill the same region so the frame height never changes;
  pagination stays hidden for error and empty, as before.
- `TableGrid` owns the virtualizer and the single scroll element. The outer
  wrapper is `overflow-auto` with `data-slot="table-scroll"`,
  `data-row-count`, and `[&>[data-slot=table-container]]:overflow-visible`,
  which neutralizes the vendored wrapper's horizontal scroll without editing
  it. Column headers stick with `position: sticky` on each `th` (not on
  `thead`, for browser support), with an opaque background and bottom border.
- Two spacer `<tr>`s carry the virtualizer's total size; they are
  `aria-hidden`, `role="none"`, and marked `data-slot="table-spacer-row"`.
- Rows use `measureElement` refs with `data-index`, `data-slot="table-row"`,
  and `aria-rowindex`. The virtualizer uses `estimateSize: 36`, `overscan: 10`,
  and the row id as its item key.
- The body scroll resets to the top in a `useLayoutEffect` when
  `scrollResetKey` changes. That key is `stateKey`, so page, page size, filter,
  and sort changes reset scroll; selection, bulk actions, and refetches do not.
- The table exposes `aria-rowcount` (data rows plus the header row); spacer
  rows are hidden from assistive technology.

### Pagination

Unchanged. The tables remain server-paged at 10/30/50/100, the URL remains the
state contract, and selection remains page-scoped. Virtualization is a
rendering concern inside the fitted body, not a paging strategy.

## Consequences

- ADR-0011 is superseded. Its rationale was correct for a document-scrolling
  page; it is not correct for a viewport-fitted table body.
- `@tanstack/react-virtual` moves from `apps/web` to `packages/shared-lib`,
  which is where `TableGrid` imports it. Route byte budgets are re-measured;
  if `/tasks` exceeds its explicit ceiling, that is a documented target
  renegotiation with the before/after measurement, never a silent ratchet
  relaxation (`docs/features/performance.md` §5).
- The virtualized DOM is smaller than the logical page. Tests assert logical
  counts through `data-row-count`/`aria-rowcount`, scroll the body to mount
  late rows, and unit tests add a narrow jsdom measurement shim (the
  virtualizer reads `clientHeight` for the scroll element and `offsetHeight`
  for rows, both `0` in jsdom). A dedicated end-to-end spec covers the fitted
  height and body-only scrolling at the default viewport.
- A future list screen must use `TablePageLayout` + `TableShellView`; a page
  that renders its own table bypasses this height contract.
- `GLOSSARY.md` is unchanged. Viewport fit and virtualization are layout and
  implementation terms, not domain language.
