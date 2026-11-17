# Refine package hooks are the table template

**Status**: accepted

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
  encoding limitation is documented in `docs/features/table-user-role.md`.

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
