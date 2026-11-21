# Tasks Table

## Summary

The Tasks screen lists the app's canonical Task entity in a Refine-native data
table built on `useTable` — server-side pagination, sorting, and filtering —
with a flat URL adapter (ADR-0016, ADR-0018). Administrators can create, edit,
delete, and bulk-edit any Task; members can act on the Tasks assigned to them.
The screen is the second consumer of the Roles table pattern and shares its URL
adapter.

## Data model

A Task has an `id`, `title`, optional `description`, `status`
(`todo | in-progress | done | blocked`), optional `priority`
(`low | medium | high`), optional `assigneeId` (a User id), optional `dueDate`
(a UTC instant), and server-set `createdAt` / `updatedAt`.

Status, priority, and assignee are `null` or empty when unset. A due date is
stored as an instant; date-only values are rejected on write.

## Permissions

| Persona             | Access                                              |
| ------------------- | --------------------------------------------------- |
| Administrator       | Any Task: view, create, edit, delete, bulk edit      |
| Member              | View all; edit/delete/bulk-edit only tasks assigned to them |

The table computes `canModify` per row (`roleId === "rol_admin"` or
`assigneeId === currentUser.id`). The API enforces the same rule for bulk
updates and returns `forbidden` per row when it is violated.

## Functional requirements

### FR-1 List

- Built with the shared table shell (`useTableShell`, which wraps
  `@refinedev/react-table`'s `useTable`); `syncWithLocation` is off and a flat
  `URLSearchParams` adapter seeds and mirrors table state. The feature keeps
  its columns, predicate selection, filter/bulk bars, and lazy overlays.
- Server-side pagination, sorting, and filtering; page size defaults to 30.
- Columns: select, `title`, `status`, `priority`, `assignee`, `dueDate`,
  actions. Sorting is enabled for title, status, priority, and due date.
- Default sort is `title` ascending.
- Status and priority render as translated labels; the due date renders in the
  user's locale and timezone; an unknown assignee id falls back to "Unknown".
- Row actions are Edit and Delete, disabled when `canModify` is false. Both
  overlays are lazy-loaded and prefetched on pointer intent.
- Loading shows skeleton rows; an empty list shows an empty state with a
  Create action when no filter is active; a failed request shows an inline
  error with retry.

### FR-2 Filters

- Search `q` — case-insensitive substring match on the title.
- Status, priority, and assignee — multi-select; no selection means all.
  Assignee includes an "Unassigned" sentinel.
- Due date — inclusive from/to range over local calendar days; the API receives
  UTC instants at the local start/end of each selected day.
- Filters combine with AND; values within a multi-select are OR'd.
- The filter bar is a controlled view of `CrudFilter[]`: every active filter
  renders a removable chip, with Clear all. The search term is a `contains`
  filter on `q` and is debounced by 300 ms.
- Any filter change resets pagination to page 1 and clears the row selection.

### FR-3 Create, edit, delete

- Create and Edit open a right-side drawer bound to Refine's `useForm`; Edit
  prefills from the row and does not issue a detail request. Empty optional
  fields are sent as `null`.
- Delete asks for confirmation and reports success/error through Refine
  notifications.
- Successful writes invalidate the resource and emit `task.created`,
  `task.updated`, or `task.deleted`.

### FR-4 Bulk edit

- Selecting one or more rows mounts a bulk bar in the page header with the
  page-scoped selection count and an Edit button. The bar is absent otherwise.
- Edit opens a sheet with status, priority, assignee, and due date. Each field
  has an explicit unchanged state; priority "None", assignee "Unassigned", and
  a cleared due date send `null`. Applying sends one PATCH containing only the
  changed fields, to `/tasks/bulk`.
- The sheet is lazy-loaded because it carries the date picker.
- Failures report the affected task titles and reasons (`not_found`,
  `forbidden`).
- Bulk delete is not available: the API has no `/tasks/bulk-delete` endpoint.
- The selection clears on any page, sort, or filter change and after a
  successful update.

### Pagination

- Server-side; the footer shows the total and a rows-per-page control.
- Page and page-size changes are reflected in the URL; a page-size change
  returns to page 1.

### URL state

- Flat, percent-encoded keys: `q`, `status`, `priority`, `assignee`,
  `dueFrom`, `dueTo`, `sort`, `order`, `page`, `pageSize`.
- Defaults are omitted (`page=1`, `pageSize=30`, `sort=title`, `order=asc`), so
  a pristine table has an empty query string.
- Multi-value filters are comma-joined (`status=todo,done`); dates are stored
  as local `YYYY-MM-DD` days.
- Unknown sort fields, enum values, dates, and junk paging values fall back to
  their defaults rather than reaching the API.
- All writes use `replace`, so Back does not walk table state.

## Non-goals

- Bulk delete.
- An audit history of Task changes.
- Assigning more than one User to a Task.
- Migrating the Users table to the Refine table pattern.
