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
