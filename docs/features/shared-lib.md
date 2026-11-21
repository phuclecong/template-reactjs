# Refactoring code to packages/shared-lib

> The DRY ("Don't Repeat Yourself") and KISS ("Keep It Simple, Stupid") principles are core software engineering standards for writing clean, maintainable code.

Create `packages/shared-lib`, `packages/shared-lib/components`, and `packages/shared-lib/hooks`, then apply DRY and KISS principles to refactor [tasks-table](../../apps/web/src/features/tasks/components/tasks-table.tsx) so it is:

- Clean: easy to read
- Reusable: reusable when creating new tables
- Maintainable: easy to fix

## Extractions

- `ComboboxFilter` (multi- and single-select) was extracted from the Tasks feature into `packages/shared-lib/src/components/combobox-filter.tsx`; it and its `FilterOption` type are exported from `@workspace/shared-lib/components`.
- `parseFilterValues` and `joinFilterValues` moved from the Tasks feature into `packages/shared-lib/src/utils/filter-values.ts` and are exported from `@workspace/shared-lib/utils`.
- Both the Tasks and Users filter bars consume the shared component and helpers; feature code keeps only its translated options, labels, and call-site wiring.
- `EmptyList` and `ErrorPanel` were extracted from the Roles feature into
  `packages/shared-lib/src/components/` and exported from
  `@workspace/shared-lib/components`. They are presentational: callers pass
  translated copy, and feature code keeps the access check (`action`) and the
  retry wiring.
- Global enum choices live behind `useEnums()` in
  `packages/shared-lib/src/hooks/use-enums.ts`; the separate
  `@workspace/shared-lib/enums` module was removed. The values derive from the
  API contract schemas, and the hook returns translated options keyed by
  constant name:
  `const { ROLE_STATUS_OPTIONS: statusOptions } = useEnums()`. Labels resolve
  as `<prefix>.<value>` from prefixes declared in the hook. It replaces the
  feature-local `useRoleStatusOptions` and the inline status/priority option
  maps in the Tasks filter bar, bulk actions, and form dialog; the per-feature
  `STATUS_OPTIONS` / `PRIORITY_OPTIONS` constants are gone.
- `DateRangeFilter` wraps the design-system `DateRangePicker` and owns the
  shared `dateRange.*` mode/preset translations, so Tasks and Roles pass only
  their feature-specific label, placeholder, clear label, and value wiring. The
  feature-scoped `dueDate*` and `date*` mode/preset keys were removed.
- `TableGrid` and `TablePagination` now own the sortable header/body rendering
  and the page-size/page-link footer that `DataTable` and the Refine-based
  Roles table had duplicated. `TableGrid` accepts a TanStack table instance
  (from either `useReactTable` or Refine's `useTable`) and an optional `onSort`
  hook; `TablePagination` takes the pagination state and callbacks plus an
  optional translated `summary`. `RolesPagination` was removed.
- Ticket #82 extracted the duplicated Refine table core once three consumers
  existed. `useTableShell` owns the URL seed/mirror, `useTable` wiring, server
  pagination, selection reset, and page totals; `TableShellView` owns the
  loading/error/empty/grid/pagination states; `createSelectionColumn` owns the
  checkbox cells shared by Roles and Tasks. The shell exposes `refineCore` and
  `reactTable` so features keep their own columns, headers, filter/bulk bars,
  overlays, delete mutations, access gating, widths, and copy. See ADR-0015's
  #82 amendment and `apps/web/test/table-shell.test.tsx` for the five
  escape-hatch proofs.

  Why this is a custom hook rather than a direct Refine hook: no Refine hook
  covers the combination. `useTable` alone does not mirror state into the flat
  encoded URL (ADR-0016), reset page-scoped selection whenever the visible rows
  change, or expose the handlers that keep Refine's page and TanStack's page
  index in step. `useTableShell` composes `useTable` and adds only that glue,
  and it returns `refineCore` and `reactTable` unchanged so features keep every
  Refine option (row actions, overlays, refetches, column visibility). The shell
  is React Router-coupled: it owns `useSearchParams` / `useNavigate` /
  `useLocation`, so `@workspace/shared-lib` is domain-free but not
  framework-neutral.

- Ticket #83 extracted the bulk-action write lifecycle ahead of a third
  bulk-action resource, an explicitly waived gate (ADR-0019; the review's
  third-consumer test still stands). `useBulkActions` in
  `packages/shared-lib/src/hooks/use-bulk-actions.ts` owns guard → mutate →
  notify (including per-row failure summaries) → track → clear the selection →
  invalidate. It composes Refine's `useCustomMutation` and `useInvalidate`
  rather than `useUpdateMany`/`useDeleteMany`, because the `simple-rest`
  provider omits the many-methods (ADR-0015). Roles and Tasks keep thin
  feature hooks — `useRolesBulkActions` and `useTaskBulkActions` — that supply
  only their endpoint (`/roles/bulk`, `/roles/bulk-delete`, `/tasks/bulk`),
  translation namespace, failure vocabulary, analytics extras, and delete
  presence; they keep their exported `RoleBulkPatch` / `TaskBulkPatch` types.
  Selection gating stays in `useTableShell`'s `enableRowSelection` (a boolean
  permission for Roles, the per-row `canModifyTask` predicate for Tasks) and is
  not duplicated in the lifecycle.

  `useClearIntent` in `packages/shared-lib/src/hooks/use-clear-intent.ts`
  replaces the explicit-clear sentinel both bulk-edit sheets copied: React Hook
  Form unsets `dirtyFields` when a field returns to its default `""`, so the
  hook records the Clear intent separately and folds it into the dirty checks.
  Feature code keeps its translated Clear labels and the field it watches
  (Roles: `description`; Tasks: `dueDate`).

  Why these are custom hooks under `AGENTS.md`: no Refine core hook covers the
  combination. `useCustomMutation` owns the request and notification but not
  per-row failure summaries, analytics, selection clearing, or list
  invalidation; `useInvalidate` is composed beside it. The many-methods are
  unavailable against `simple-rest`. `useClearIntent` is local form state, not
  data fetching, so no data hook applies. Tests live in
  `apps/web/test/bulk-actions.test.tsx` (shared lifecycle) and
  `apps/web/test/use-clear-intent.test.tsx` (shared sentinel); the pinned
  feature behaviour remains in `apps/web/test/roles-bulk-actions.test.tsx` and
  `apps/web/test/tasks-bulk-actions.test.tsx`.

## Virtualized fitted table body

`TableGrid` owns both the fitted table's single scroll element
(`data-slot="table-scroll"`) and the virtualizer, so features do not wrap or
reimplement either. The grid composes a native `<table>` inside the scroll
element: the vendored shadcn primitive stays unedited (ADR-0009), its
horizontal overflow is neutralized with a selector variant on the wrapper, and
the header cells stick to the top of the body. The scroll element has no tab
stop; keyboard users reach the focusable controls inside it and the browser
scrolls focused rows into view.

The body uses `useVirtualizer` from `@tanstack/react-virtual` with the page row
model as its count, a 36px estimate, and 10 rows of overscan. Row height is
measured dynamically: each mounted row registers through `measureElement` and
carries its virtual index in `data-index`, so the taller Users role selector is
sized correctly without a per-table height setting and without overlap or
clipping. The row id is the virtualizer's item key.

Only the virtual items render. Two spacer `<tr>`s carry the virtualizer's
total size, one before and one after the mounted window, and collapse to zero
height as the window reaches either end. They are `aria-hidden`, carry
`role="none"`, expose `data-slot="table-spacer-row"`, and contain no visible
cell content, so the body's scroll height is exact and assistive technology
never hears a phantom row.

The accessibility and test contract is explicit:

- `data-row-count` on the scroll element is the logical page row count, not the
  mounted count, and `aria-rowcount` on the table is that count plus the header
  row.
- Each data row keeps `data-slot="table-row"` and exposes
  `aria-rowindex={data-index + 2}` in the full logical row space.
- Tests assert logical counts through `data-row-count`/`aria-rowcount`, and
  scroll the body (via the e2e `scrollRowIntoView` helper) to mount late rows;
  they never infer data count from mounted `<tr>`s.

The body scroll resets to the top in a layout effect when `scrollResetKey`
changes. The shell passes `stateKey`, derived from page, page size, filters, and
sort, so those list-state changes reset the body while selection, bulk actions,
and refetches leave it where the user left it.

Selection stays page-scoped. TanStack owns it over the full row model, not the
mounted window: select-all covers every record on the page including unmounted
rows, the bulk bar reports them, a row checkbox reflects selection when it
re-mounts, and a bulk action can target a row that was not mounted when it was
selected. Virtualization is a rendering concern inside the fitted body, not a
paging strategy; server pagination, the page sizes, and the flat URL contract
are unchanged. See
[ADR-0020](../adr/0020-tables-fit-viewport-and-virtualize.md).

Unit tests exercise the real virtualizer in jsdom through a narrow measurement
shim in `apps/web/test/setup.ts`: it gives only the table scroll element a
viewport-sized `clientHeight`, virtual rows a fixed `offsetHeight`, and supplies
a `ResizeObserver` stand-in. The virtualizer is not mocked. Route-level
behaviour (mounted count, late-row scrolling, dynamic Users row measurement,
pinned header and pagination, and selection across scroll) is covered by
`apps/web/e2e/virtualized-table.spec.ts`.
