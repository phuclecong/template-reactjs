# Roles table stores URL state as flat query parameters

**Status**: accepted

The Roles table turns Refine's `syncWithLocation` off and mirrors `useTable`
state to the URL with `URLSearchParams` instead. The URL uses flat, encoded
keys: `title`, `description`, `status`, `createdAtFrom`, `createdAtTo`,
`updatedAtFrom`, `updatedAtTo`, `sort`, `order`, `page`, and `pageSize`.
Defaults are omitted. Date bounds are local `YYYY-MM-DD` days; the filter
builder converts them to UTC instants for the API request.

## Context

ADR-0015 chose the built-in sync and accepted its encoding limitation. In
practice that serialization wrote bracket keys (`filters[0][field]`) without
encoding values, so a text filter containing `&`, `=`, `#`, or `%` corrupted
deep links, and the Roles URL used a different convention from the Users and
Tasks tables.

## Considered Options

- **Keep `syncWithLocation` and avoid reserved characters in text filters**:
  works only by convention and silently loses state when a User ignores it.
- **Configure Refine's serializer**: the table sync does not expose an
  encoding hook; it stringifies through `go` (Refine's `qs`-based navigation)
  with encoding disabled.
- **Reuse `useTableState`**: it drives `useList`, not
  `@refinedev/react-table`'s `useTable`, and its scalar filter values do not
  match the Roles filter bar's `CrudFilter[]` model. Adapting it would mean
  writing the same two-way sync plus a second state shape.
- **Feature-local adapter (chosen)**: `utils/url-state.ts` parses the query
  string into `useTable`'s initial filters, sorters, page, and page size, and
  serializes state changes back. Refine's table hooks still own data fetching
  and the TanStack table.

## Consequences

- `apps/web/src/features/roles/utils/url-state.ts` owns URL parsing and
  serialization; `RolesTable` seeds `useTable` from it and mirrors state back.
- Values are percent-encoded, so reserved characters in text filters round-trip.
- `status` stays a single comma-joined parameter, consistent with ADR-0008,
  and URLSearchParams encodes the comma as `%2C`.
- Old links using `currentPage`/`sorters[...]`/`filters[...]` fall back to the
  table defaults on load; the first state change drops the legacy keys.
- Writes use `replace`, matching the previous sync, so filter, sort, and page
  changes do not add history entries.

## Amendments

- ADR-0018 moves the parsing/serialization into
  `packages/shared-lib/src/hooks/url-table-state.ts` and migrates Tasks onto the
  same adapter. This ADR's Roles-specific keys and defaults are unchanged; the
  feature-local `roles/utils/url-state.ts` now supplies only the descriptor
  config.
