# Refine package hooks are the table template

**Status**: accepted; the `syncWithLocation` choice is superseded by ADR-0016

The Roles screen is built with `useTable` and `useModalForm` from
`@refinedev/react-table` and `@refinedev/react-hook-form`, while Users and Tasks
keep the existing `useList` + `useTableState` + `DataTable` stack. The template
should demonstrate Refine's table and form integration — server pagination,
sorting, filtering, `syncWithLocation`, and the modal-form lifecycle — not just
its data hooks; the adapters are peer-compatible with the pinned core, React,
TanStack Table, and react-hook-form versions, and a new shared wrapper around
`useTable` would hide the options that make it useful. Roles becomes the
reference implementation; future tables follow it until a second consumer
justifies extraction.

## Considered Options

- **Reuse the existing `useTableState` + `DataTable` recipe**: no new
  dependencies and one paradigm, but it would not exercise the Refine
  table/form adapters and would keep the Roles screen on a hand-rolled URL
  layer.
- **Wrap `useTable` in a new shared-lib component**: reusable, but premature
  with one consumer and likely to hide `refineCore` state, `reactTable`, and
  `syncWithLocation`.
- **Migrate Users and Tasks at the same time**: consistency, but a
  feature-sized change becomes an app-wide rewrite with regression surface and
  no requirement behind it.
- **`useTable` with a custom URL adapter instead of `syncWithLocation`**: would
  encode filter values correctly and keep clean keys, but loses a Refine
  feature and adds a two-way URL mapping. The built-in sync was preferred; its
  encoding limitation is recorded in ADR-0016.

## Consequences

- Two table paradigms and two URL conventions coexist: Roles uses
  `currentPage`/`pageSize`/`sorters[...]`/`filters[...]`; Users and Tasks keep
  their scalar `q`/`page`/`sort` keys.
- `@refinedev/react-table@^6.0.1` and `@refinedev/react-hook-form@^5.0.4` become
  dependencies.
- Refine serializes table params with `encode: false`; text-filter values
  containing `&`, `=`, `#`, or `%` corrupt deep links and reload. Accepted and
  documented.
- `simple-rest` omits `updateMany`/`deleteMany`, so bulk actions use
  `useCustomMutation` against `/roles/bulk` and `/roles/bulk-delete`, with
  explicit `useInvalidate`.
- `useModalForm` edit prefill requires `GET /roles/{id}`.
- The table overrides Refine's default page size of 10 to 30; the seed is 60
  Roles so pagination is exercised.

## Amendments

- ADR-0018 migrates Tasks to the same `useTable` pattern and extracts the flat
  URL adapter into `shared-lib`. The "two table paradigms" consequence now
  applies to Users alone, and "a shared wrapper around `useTable` would hide the
  options" still holds — only the URL layer is shared.
- The 2026-11-21 follow-through (#78) then migrates Users too. Users, Roles,
  and Tasks all use `useTable`; `useTableState` and `DataTable` are removed, so
  the two-paradigm consequence above is fully superseded.
- Ticket #82 resolves the deferral in this ADR. With three consumers on the
  shared path and all five escape hatches proven, the shared table shell is
  adopted: `useTableShell` owns the URL seed/mirror, `useTable` wiring, server
  pagination, and page-scoped selection; `TableShellView` owns the
  loading/error/empty/grid/pagination states; `createSelectionColumn` owns the
  duplicated checkbox cells. The shell returns `refineCore` and `reactTable`
  unchanged, so it does not hide Refine's options — the concern that deferred
  extraction. Features keep their columns, headers, filter and bulk bars,
  overlays and delete mutations, access gating, widths, and translated copy.
  The "shared wrapper would hide the options" sentence above is superseded by
  this amendment.

  A custom hook is justified rather than reusing a Refine hook directly: no
  Refine hook owns this combination. `useTable` does not mirror table state
  into the flat, encoded URL format required by ADR-0016, does not reset the
  page-scoped selection when filters, sorters, or pagination change, and does
  not expose the feature-facing `goToPage` / `changePageSize` /
  `changeFilters` handlers that update both pagination layers. `useTableShell`
  composes `useTable` and adds only that glue — it does not reimplement
  Refine's data, sort, filter, or pagination logic. It also returns
  `refineCore` and `reactTable` unchanged, so the hook exposes the composed
  Refine surface rather than hiding it.

- ADR-0019 records the sibling extraction from the same follow-through: the
  shared bulk-action lifecycle (`useBulkActions`, #83) composes
  `useCustomMutation` and `useInvalidate` for the same `simple-rest` reason
  this ADR records — the provider omits `updateMany`/`deleteMany`.
