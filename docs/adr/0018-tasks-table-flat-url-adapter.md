# Tasks table follows the Roles Refine table pattern

**Status**: accepted

The Tasks table moves from `useList` + `useTableState` + `DataTable` to
`@refinedev/react-table`'s `useTable`, seeded and mirrored through a flat URL
adapter, as ADR-0015 anticipated. Tasks is the second consumer, so the URL
encoding rules were extracted into
`packages/shared-lib/src/hooks/url-table-state.ts`
(`createTableUrlAdapter`), and Roles was migrated onto it in the same change.
The adapter is descriptor-driven — text, comma-joined enum, and date-range
filters — and keeps the feature-specific keys in each feature's
`utils/url-state.ts`.

Tasks keeps its existing URL keys (`q`, `sort`, `order`, `page`, `pageSize`,
`status`, `priority`, `assignee`, `dueFrom`, `dueTo`), default `title asc`
sort, and page size 30, so old deep links keep working. All table writes use
`replace`, matching Roles, so Back no longer walks table state.

The filter bar is now a controlled view of `CrudFilter[]` like Roles: the
search term is a `contains` filter on `q`, every active filter has a chip, and
Clear all replaces the standalone button. The optimistic navigation machinery
was removed in favour of Roles' debounce + render-time sync.

Bulk work adopts the Roles shape: a bar with the selection count and an Edit
button, mounted only with a selection, opening a sheet with `status`,
`priority`, `assigneeId`, and `dueDate`. Each field has an explicit unchanged
state; priority "None", assignee "Unassigned", and a cleared due date are sent
as `null`. One dirty-field PATCH is the only confirmation, and the sheet stays
code-split because it carries the calendar. There is no bulk delete: Tasks has
no `/tasks/bulk-delete` endpoint and the product requirements never asked for
one. Selection remains per-row (`canModify`: administrator or assignee) rather
than Roles' resource-level gate, and resets on any page, sort, or filter change
including `q`.

`useTable` owns fetching, so the old read hook shrank to a user lookup
(`use-task-rows.ts`); the form overlays take `TaskRecord` directly instead of a
mapped `TaskRow`. Dropping `DataTable` also adds the Roles loading/empty/error
trio, including an inline retry Tasks did not have.

## Considered Options

- **Keep a feature-local URL adapter in each table**: no shared-lib surface,
  but the second consumer made the duplicated encoding, validation, and
  date-bound rules the thing worth removing.
- **Keep `useTableState` + `DataTable` for Tasks**: no new surface, but leaves
  the template with two table paradigms after ADR-0015 named Roles the
  reference.
- **Adopt `syncWithLocation`**: still rejected for the encoding reason recorded
  in ADR-0016.
- **Copy the full Roles bulk UI including Delete**: would require a new API
  endpoint, mock handlers, and regenerated types; deferred as a separate issue.
- **Extract a wrapper around `useTable` itself**: rejected in ADR-0015 and still
  unnecessary; only the URL layer is shared.

## Consequences

- `createTableUrlAdapter` is shared and unit-tested; both Roles and Tasks keep
  their feature-local key configuration.
- Users remains the only consumer of `useTableState` + `DataTable`; the
  two-paradigm consequence of ADR-0015 now applies to Users alone.
- The Tasks bulk event is `{ action: "update", fields: [...], selected,
  updated, failed }`, replacing the one-event-per-field payload.
- Bulk-edit failures report per-task reasons (`not_found`, `forbidden`).
- Tasks URLs still round-trip reserved characters because values are
  percent-encoded by `URLSearchParams`.
- Bulk delete for Tasks is not available until the contract gains an endpoint.

## Amendments

- The 2026-11-21 architecture review follow-through extends the descriptor to
  the filter-bar direction: a pure shared module derives bar values,
  `CrudFilter[]`, clear semantics, and chips from the same declaration, so the
  operator and date-bound rules are encoded once. Filter bars stay hand-written;
  only conversion and chip derivation are shared, and no shared chip container
  is extracted. Invalid or overflowed `YYYY-MM-DD` input becomes "no bound"
  rather than throwing, matching the URL adapter's deep-link behaviour and
  replacing Roles' regex-only check; the detailed signatures live in the
  follow-up issue.
