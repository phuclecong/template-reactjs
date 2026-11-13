# Multi-value table filters use `in` arrays

**Status**: accepted

Multi-value filters store their values as a comma-joined single URL param (`status=todo,done`) and `toCrudFilters` expands that into a Refine `in` filter, which `simple-rest` serializes as repeated API query params (`status=todo&status=done`); values are OR'd within a field and fields are AND'd. Chosen because `useTableState` and its consumers are built around scalar URL values and Refine's provider already turns `in` arrays into repeated params, so neither a shared-lib array migration nor a custom data-provider bridge is needed.

## Considered Options

- **Repeated params in the app URL** (`status=todo&status=done`): would require changing `useTableState` to `getAll`/arrays and ripples into every table, including the Users table, whose Role filter stays single. Rejected.
- **Comma-joined end to end**: the API would parse comma strings, overloading scalar parameters and bypassing enum validation. Rejected.
- **Custom data-provider bridge**: unnecessary once `in` was confirmed to serialize as repeated params. Rejected.

## Consequences

- `status`, `priority`, and `assigneeId` become array query params in `openapi.yaml`; `packages/api/src/generated/api.d.ts` is regenerated.
- The mock handlers read `getAll` for those params, validate each value, and apply the unassigned-null OR for assignees.
- The Users Role filter, due-date bounds, and `useTableState` stay scalar and unchanged.
- Filter values must not contain commas. Status/priority enums, user ids, and the `unassigned` sentinel do not.
- Multi-value semantics are OR within a field, AND across fields.
