# User Roles Management

## Summary

A back-office screen that lets administrators manage **Roles** — the named,
described access groupings every User holds. The screen is a Refine-native data
table built on `useTable` and `useModalForm`: server-side pagination, sorting,
and filtering; per-row create, edit, and delete; and bulk edit/delete.
Administrators have full access; members are read-only staff. The screen does
not manage the permissions attached to a Role or assign Roles to Users — the
Users screen owns assignment.

## Problem

Roles are currently a closed `admin | member` enum in the API and UI, editable
only through code and seeds. There is no way to review which Roles exist, what
each one is for, or whether one is still active, and adding a Role requires a
code change.

## Goals

- List all Roles with their key attributes in one paginated table.
- Narrow the list quickly with filters: title, description, created/updated date
  ranges, and status.
- Create, edit, and delete a single Role.
- Update several Roles at once (bulk edit of description and status; bulk
  delete).

## Non-goals

- Managing the individual permissions attached to a Role.
- Assigning Roles to Users from this screen; the Users screen owns assignment.
- Audit history of Role changes.
- Migrating the Users or Tasks tables to the Refine table pattern.

## Users and permissions

| Persona                   | Access                                                     |
| ------------------------- | ---------------------------------------------------------- |
| Administrator (`rol_admin`) | Full: view, create, edit, delete, bulk edit, bulk delete |
| Member (read-only staff)  | View and filter only; action controls hidden               |

Enforced in two places: `accessControlProvider`/`useCan` hide or deny UI
actions, and the API returns 403 for write endpoints called by a non-admin.

## Data model

### Role

| Field         | Type          | Notes                                                                       |
| ------------- | ------------- | --------------------------------------------------------------------------- |
| `id`          | string        | Stable identifier; server-generated `rol_<uuid>`. Seeded: `rol_admin`, `rol_member`. |
| `title`       | string        | Required, 1–100 characters after trimming, unique case-insensitively.        |
| `description` | string \| null | Optional, at most 500 characters after trimming; empty input stored as `null`. |
| `status`      | enum          | `active` \| `inactive`; defaults to `active`.                                |
| `createdAt`   | ISO date      | Read-only, server set.                                                       |
| `updatedAt`   | ISO date      | Read-only, server set on every write.                                        |

There is no separate key or slug. `id` is the stable reference auth uses.

**System Roles.** `rol_admin` and `rol_member` are seeded System Roles. Their
`id` is immutable; their title and description are editable; they cannot be
deleted or set to `inactive`. Bulk status updates report them as failed per
row.

### User relationship

A User response carries `roleId` and an embedded `role: { id, title, status }`
summary. Every User holds exactly one Role; registration defaults to
`rol_member`. Admin access means `roleId === "rol_admin"`; every other Role is
member-equivalent read-only staff until a permissions model exists. An
`inactive` Role stays assigned to its existing Users but is disabled as a new
assignment choice. Status never revokes access.

## Functional requirements

### FR-1 List

- The table is built with `useTable` and uses server-side pagination, sorting,
  and filtering.
- Page size defaults to 30.
- Columns: `title`, `description`, `status`, `createdAt`, `updatedAt`, and, for
  administrators, a selection checkbox and a row-actions column.
- `status` renders as a badge: `active` (green), `inactive` (grey).
- Dates render in the local timezone as `YYYY-MM-DD HH:mm`.
- Default sort: `updatedAt` descending.
- The empty state shows a short message and, for administrators, a "Create
  role" button.
- Loading shows skeleton rows. A failed list request shows an inline error with
  a retry button.
- Long descriptions truncate with a tooltip showing the full text.
- Row actions are "Edit" and "Delete", available to administrators only. System
  Roles hide "Delete".

### FR-2 Filters

- `title` — text, contains match.
- `description` — text, contains match.
- `createdAt` — date range: from / to, inclusive.
- `updatedAt` — date range: from / to, inclusive.
- `status` — single select: All / Active / Inactive.
- Filters combine with AND semantics and reset pagination to page 1.
- Active filters are visible as removable chips, with a "Clear all" action.
- Text filters are debounced by 300 ms.
- Date bounds are stored as UTC instants representing the local start of the
  From day and the local end of the To day. The picker converts them back to
  local dates for display.
- The table uses Refine's `syncWithLocation`. The URL uses `currentPage`,
  `pageSize`, `sorters[0][field]`, `sorters[0][order]`, `filters[0][field]`,
  `filters[0][operator]`, and `filters[0][value]`, so filter, sort, and page
  state survive reload and are shareable.

Example:

```
/roles?currentPage=1&pageSize=30
&sorters[0][field]=updatedAt&sorters[0][order]=desc
&filters[0][field]=title&filters[0][operator]=contains&filters[0][value]=admin
```

**Known limitation.** Refine serializes table parameters with `encode: false`.
A text filter value containing `&`, `=`, `#`, or `%` corrupts the URL and loses
state on reload. This is accepted and documented; avoid reserved characters in
text filters.

### FR-3 Create

- "Create role" opens the form in a drawer (`Sheet`) controlled by
  `useModalForm`.
- Fields: `title` (required), `description` (optional), `status` (defaults to
  `active`). `id`, `createdAt`, and `updatedAt` are never user-editable.
- The form uses one Zod schema shared with edit and bulk edit.
- Submit goes through Refine's `onFinish`; validation errors render inline and
  server errors render at form level.
- Success closes the drawer, resets the form, shows a toast, and refreshes the
  list.
- Cancel discards changes after a confirmation prompt when the form is dirty.

### FR-4 Edit

- Row action "Edit" opens the same drawer with `useModalForm` in edit mode.
- The form is pre-filled through `GET /roles/{id}`.
- Only dirty fields are submitted; `createdAt` and `id` cannot change.
- Submit is disabled while the mutation is pending; a success toast confirms
  the change and the list refreshes.

### FR-5 Delete

- Row action "Delete" asks for confirmation showing the Role title.
- Success refreshes the table and shows a toast.
- If any User holds the Role, the server returns 409; the error is surfaced as
  a toast and the row stays.
- System Roles cannot be deleted; the action is hidden and the API rejects the
  request.

### FR-6 Bulk actions

- Selecting rows enables a bulk action bar showing the selected count.
- Bulk "Edit" opens a form where only `description` and `status` are editable.
  `title` is excluded because it is unique.
- Only fields the user actually changed are sent; untouched fields are left
  unchanged. Clearing `description` sends `null`.
- Bulk "Delete" is available to administrators and requires confirmation.
- Both bulk actions report partial failures per row: a Role referenced by a User
  cannot be deleted, and a System Role cannot be set inactive.
- Selection is cleared after an action or when filters, sort, or page change.
- The header checkbox selects/deselects all rows on the current page.

## API contract

| Method | Path                | Auth          | Purpose                                              |
| ------ | ------------------- | ------------- | ---------------------------------------------------- |
| GET    | `/roles`            | authenticated | List with pagination, sorting, and filters           |
| GET    | `/roles/{id}`       | authenticated | Edit prefill                                         |
| POST   | `/roles`            | admin         | Create                                               |
| PATCH  | `/roles/{id}`       | admin         | Partial edit                                         |
| DELETE | `/roles/{id}`       | admin         | Delete; 409 when referenced                          |
| PATCH  | `/roles/bulk`        | admin        | `{ ids, description?, status? }` → `{ updated, failed }` |
| POST   | `/roles/bulk-delete` | admin        | `{ ids }` → `{ deleted, failed }`                    |

- List filters: `title`/`description` contains, `createdAt`/`updatedAt`
  `gte`/`lte`, `status` eq.
- Sortable fields: `title`, `status`, `createdAt`, `updatedAt`.
- `User` gains `roleId` and the embedded `role` summary; `UpdateRoleRequest`
  becomes `{ roleId }`.
- Validation: duplicate title → 409; missing or blank title, over-length fields,
  or an invalid status → 400; missing Role → 404; non-admin write → 403.
- Bulk responses carry `failed: [{ id, reason }]`; reasons include
  `not_found`, `referenced`, `system_role`, and `validation`.
- `simple-rest` does not implement `updateMany`/`deleteMany`, so the bulk
  endpoints are called through `useCustomMutation` with explicit invalidation.

## UX notes

- Layout: page title, "Create role" primary button, filter bar, active-filter
  chips, table, footer with totals and pagination.
- Rows are dense; long descriptions truncate with a tooltip.
- Forms open in a `Sheet` drawer; delete and bulk delete use `ConfirmDialog`.
- Every destructive action is confirmed; every write shows a toast.
- Keyboard: filters and pagination are reachable by tab; row actions open on
  Enter.
- Members see the page, table, and filters but no create, edit, delete,
  selection, or bulk controls.

## Implementation notes

### Dependencies

- `@refinedev/react-table@^6.0.1`
- `@refinedev/react-hook-form@^5.0.4`

Both are compatible with `@refinedev/core@5.0.12`, React 19, TanStack Table 8,
and react-hook-form 7.

### Hooks

- `useTable` — list state and the TanStack table instance (`reactTable` +
  `refineCore`).
- `useModalForm` — create/edit drawer lifecycle and mutations.
- `useCustomMutation` + `useInvalidate` — bulk update/delete.
- `useDelete` — single delete.
- `useCan` / `CanAccess` — action visibility.
- `useSelect` — Role options on the Users screen.

### Table rendering

The Roles table renders with `@workspace/ui` `Table` primitives driven by the
TanStack instance. It does not use the shared `DataTable` or `useTableState`.
Presentational controls are reused: `FilterCombobox`, `DateRangePicker`,
`Input`, `Select`, `TableSkeleton`, `Pagination`, `Sheet`, and `ConfirmDialog`.

A vendored shadcn `Badge` is added to `packages/ui` for the status badge. The
list error/retry panel is feature-local.

### Access control

`accessControlProvider` gains a `roles` resource: admins may do everything;
members may `list` only. The UI uses `useCan`/`CanAccess` for create, edit,
delete, and bulk actions. The API enforces the same rules.

### Seeds and observability

Seed `rol_admin`, `rol_member`, and 58 demo Roles (60 total, two pages at size
30) with varied statuses and timestamps. Demo Roles have no Users.

Emit business events from the existing observability module: `role.created`,
`role.updated`, `role.deleted`, and `role.bulk_action`.

### Tests

- API smoke tests for list, filters, sorting, pagination, create, edit, delete,
  bulk update, bulk delete, auth, validation, reference guard, and System Role
  protection.
- Feature unit tests for the filter builders and the bulk payload.
- Component tests for the filter chips and bulk bar.
- E2E tests for list/filter/sort/page URL state, create/edit/delete, bulk
  actions, System Role protection, and the member read-only view. Update URL
  assertions to Refine's `currentPage`/`sorters[...]`/`filters[...]` format.

### Known consequences

- Users and Tasks keep the existing `useList` + `useTableState` + `DataTable`
  stack, so two table paradigms and two URL conventions coexist. ADR-0015
  records the choice.
- Refine's unencoded table URL is an accepted limitation (see FR-2).
- The Roles list requires `GET /roles/{id}` for edit prefill.
- Page size is 30 and the seed is 60 Roles, so pagination is exercised.

## Acceptance criteria

- [ ] The table lists Roles with all columns, server-side pagination, and
      server-side sorting; the default sort is `updatedAt` descending.
- [ ] All five filters work, combine with AND semantics, produce removable
      chips, and clear individually or together.
- [ ] Filter, sort, and page state appears in the URL in Refine's format and
      restores on reload.
- [ ] A Role can be created, edited, and deleted with toasts and a refreshed
      list.
- [ ] Bulk edit updates only `description` and/or `status` on selected Roles;
      untouched fields stay unchanged.
- [ ] Bulk delete reports per-row failures for referenced and System Roles.
- [ ] System Roles cannot be deleted or set inactive.
- [ ] Deleting a Role held by a User returns 409 and keeps the row.
- [ ] Members see no action controls and the API rejects their writes.
- [ ] The Users screen renders Role titles, assigns via `roleId`, and disables
      inactive Roles for assignment.
- [ ] Business events are emitted for create, edit, delete, and bulk actions.
- [ ] Tests cover the API contract, filter mapping, bulk payload, and the UI
      flows above.
