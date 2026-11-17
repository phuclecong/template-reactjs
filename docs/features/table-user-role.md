# User Roles Management

## Summary

A back-office screen that lets administrators manage **user roles** (a named,
described permission grouping). The screen is a data table with filtering,
sorting, pagination, per-item actions, and bulk actions over a set of roles
stored through the app's data provider.

## Problem

Roles are currently edited by hand (database/seed scripts) and there is no way
for an admin to review which roles exist, what each one is for, or whether a role
is still in use. This makes role changes slow and error prone.

## Goals

- List all roles with their key attributes in one paginated table.
- Narrow the list quickly with filters (text, date range, status).
- Create, edit, and delete a single role.
- Update several roles at once (bulk edit of title, description, status).

## Non-goals

- Managing the individual permissions attached to a role.
- Assigning roles to users.
- Audit history of role changes.

## Users and permissions

| Persona         | Access                                       |
| --------------- | -------------------------------------------- |
| Administrator   | Full: view, create, edit, delete, bulk edit  |
| Read-only staff | View and filter only; action controls hidden |

## Data model

| Field         | Type     | Notes                                         |
| ------------- | -------- | --------------------------------------------- |
| `id`          | string   | Server generated, read-only, used as row key  |
| `title`       | string   | Required, 1–100 chars, unique                 |
| `description` | string   | Optional, max 500 chars                       |
| `createdAt`   | ISO date | Read-only, server set                         |
| `updatedAt`   | ISO date | Read-only, server set on every write          |
| `status`      | enum     | `active` \| `in-active`, defaults to `active` |

## Functional requirements

### FR-1 List

- The table loads through `useTable` with server-side pagination, sorting, and
  filtering.
- Columns: `title`, `description`, `status`, `createdAt`, `updatedAt`, and a
  row-actions column.
- `status` renders as a badge: `active` (green), `in-active` (grey).
- Dates render in the local timezone, `YYYY-MM-DD HH:mm`.
- Default sort: `updatedAt` descending.
- Empty state shows a short message plus a "Create role" button.
- Loading state shows skeleton rows; errors show a retry button.

### FR-2 Filters

- `title` — text, contains match.
- `description` — text, contains match.
- `createdAt` — date range (from / to, inclusive).
- `updatedAt` — date range (from / to, inclusive).
- `status` — select: All / Active / In-active.
- Filters combine with AND semantics and reset pagination to page 1.
- Active filters are visible as removable chips, with a "Clear all" action.

### FR-3 Create

- "Create role" opens the form in a drawer.
- Fields: `title` (required), `description` (optional), `status` (defaults to
  `active`). `id`, `createdAt`, `updatedAt` are never user editable.
- Submit calls `useForm`'s `onFinish`; the table refreshes on success.
- Validation errors are shown inline; server errors are shown at form level.
- Cancel discards changes after a confirmation prompt when dirty.

### FR-4 Edit

- Row action "Edit" opens the same form pre-filled with the role's values.
- Saving updates only changed fields and preserves `createdAt`.
- Submit is disabled while the mutation is pending; a success toast confirms the
  change.

### FR-5 Delete

- Row action "Delete" asks for confirmation showing the role title.
- Deleting refreshes the table and shows a success toast.
- If the role is referenced elsewhere the server rejection is surfaced as an
  error toast and the row is kept.

### FR-6 Bulk actions

- Selecting rows enables a bulk action bar with the selected count.
- Bulk "Edit" opens a form where only `title`, `description`, and `status` are
  editable; untouched fields are left unchanged on every selected role.
- Bulk "Delete" is available to administrators with a confirmation step.
- Selection is cleared after an action or when filters change.
- Header checkbox selects/deselects all rows on the current page.

## UX notes

- Layout: page title, "Create role" primary button, filter bar, table, footer
  with totals and pagination.
- Table rows are dense; long `description` values truncate with a tooltip.
- Every destructive action is confirmed; every write shows a toast.
- Keyboard: filters and pagination reachable by tab; row actions open on Enter.

## Implementation notes

- Hooks: `useTable`, `useForm`, and `useList`/`useUpdate`/`useDelete`/
  `useCreate` from refine.
- References:
  - `docs/refine-doc/core/src/hooks/index.ts`
  - `docs/refine-doc/docs/packages/tanstack-table/use-table/index.md`
  - `docs/refine-doc/docs/data/hooks/use-table/index.md`
  - `docs/refine-doc/docs/packages/react-hook-form/use-form/index.md`
  - `docs/refine-doc/docs/data/hooks/use-form/index.md`
- Filter state is kept in the URL query string so views are shareable.
- Form schema lives in one Zod schema shared by create, edit, and bulk edit.

## Acceptance criteria

- [ ] Table lists roles with all columns and server-side pagination/sorting.
- [ ] All five filters work and can be combined and cleared.
- [ ] A role can be created, edited, and deleted with toasts and refreshed data.
- [ ] Bulk edit updates `title`, `description`, and `status` on selected rows.
- [ ] Read-only users see no action controls.
- [ ] URL reflects filter and page state and restores it on reload.
