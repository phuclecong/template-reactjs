# Combobox

## Summary

Unify searchable selection across the app on one `Combobox` primitive built on
Base UI, then migrate the filter bars and the Task bulk actions to it. Filters
gain multi-select for Status, Priority, and Assignee; bulk actions become one
searchable, grouped action list with a confirmation step.

Reference: https://ui.shadcn.com/docs/components/base/combobox
Decision record: `docs/adr/0008-multi-value-table-filters.md`

## Scope

### In scope

- One shared `Combobox` primitive in `packages/ui`, single- and multi-select.
- Tasks filter bar: Status, Priority, and Assignee become multi-select.
- Users filter bar: Role becomes a single-select `Combobox`.
- Task bulk actions: one grouped, searchable action list with a confirmation
  dialog.
- Multi-value filter support through the URL, the mock API, and the OpenAPI
  contract.

### Out of scope

- Form `Select`s in `task-dialogs.tsx` and the inline Role editor in
  `users-table.tsx`.
- The sidebar's `DropdownMenu` (navigation, not selection).
- Multi-value Role filtering.
- A first-class `loading` prop on the primitive.
- A mobile `Sheet` variant of the Combobox.

## Design Decisions

### Foundation and API

- Build on `@base-ui/react/combobox`. No `cmdk` dependency and no custom
  filtering code.
- Export a thin, composable surface, matching the `Select`/`Popover` wrappers:
  `data-slot`, `cn` from `"cn"`, named exports, no default export.
- Export exactly:
  `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`,
  `ComboboxItem`, `ComboboxItemIndicator`, `ComboboxEmpty`, `ComboboxGroup`,
  `ComboboxLabel`, `ComboboxSeparator`, `ComboboxChips`, `ComboboxChip`,
  `ComboboxChipRemove`, `ComboboxValue`, `ComboboxTrigger`, `ComboboxIcon`,
  `ComboboxClear`, `ComboboxStatus`.
- `ComboboxInput` is the single input part, used both standalone and inside
  `ComboboxChips`. There is no separate "chips input" part.
- `ComboboxContent` bundles `Portal > Positioner > Popup`, like
  `SelectContent`. Defaults: `side="bottom"`, `align="start"`,
  `sideOffset={4}`, anchor width (`w-(--anchor-width)`), `max-h-64`, and
  `overflow-y-auto`. Callers may override with `className`.
- Base UI's `Backdrop`, `Arrow`, `Row`, `Collection`, `createItems`, and
  `useFilter` are not wrapped until a caller needs them.
- Controlled (`value`/`onValueChange`) and uncontrolled (`defaultValue`) come
  from Base UI's Root. `disabled` comes from the Root as well.

### Interaction patterns

- **Filter bars** use an inline `Combobox.InputGroup` field. Chips, per-chip
  remove buttons, and the text input are visible; typing or focusing opens the
  list. Removable chips cannot live inside a `<button>`, so filters do not use a
  button trigger.
- **Bulk actions** use a `ComboboxTrigger` rendered as a `Button` labelled
  "Bulk actions". The popup contains a search input and the grouped action
  list; it has no chips.

### Filter semantics

- Status, Priority, and Assignee are multi-select. Values are OR'd within a
  field and fields are AND'd.
- The explicit "All" item is removed everywhere. An empty selection means "all"
  and the placeholder reads "All". The Tasks toolbar's existing "Clear filters"
  button remains. Task filter fields have no separate field-level clear
  control: selected values are removed individually through their chip remove
  buttons. The single-select Users Role field shows a labelled clear control
  while a role is selected.
- Selected values render as chips inside the field. Chips wrap onto multiple
  lines rather than truncating or scrolling.
- Each `ComboboxChipRemove` has a translated accessible name.
- The Users Role filter is single-select and stays scalar. Empty means "all".
- There are no separate toolbar filter chips. Chips live in the field; the
  earlier "keep the toolbar filter chips in sync" line is dropped.

### Multi-value contract

- The app URL stores a comma-joined value in the existing scalar param:
  `status=todo,done`, `priority=low,high`,
  `assignee=<id>,unassigned`.
- `TaskFilters` stays `Record<TaskFilterKey, string>` and `useTableState` stays
  scalar. The filter bar converts between the comma string and the combobox's
  `string[]`.
- `toCrudFilters` splits the value on `,`: one value emits `eq`, multiple emit
  `in`.
- Refine's `simple-rest` maps `in` to a repeated API param
  (`status=todo&status=done`); no data-provider bridge is needed.
- OpenAPI declares `status`, `priority`, and `assigneeId` as array query params
  (`style: form`, `explode: true`); regenerate
  `packages/api/src/generated/api.d.ts`.
- The mock handler reads `getAll` for those params, validates each value, and
  ORs `unassigned` with `assigneeId == null`.
- The Users Role filter, due-date bounds, and `useTableState` are unchanged.

### Bulk actions

- One grouped `Combobox` (single-select, controlled `value={null}` so the
  trigger never shows the last action) replaces the three `DropdownMenu`s.
- Groups: Status, Priority, Assignee, and Due date. Due date contains the
  "Clear due date" action. The `DatePicker` sits inside the same popup, below
  the grouped action list.
- Search matches the group label plus the item label, so "assign", "status",
  "priority", and "done" all find their actions.
- Selecting an action closes the popup and opens `ConfirmDialog` before every
  discrete action, including "Clear due date". Copy is generic:
  `Apply "{{action}}" to {{count}} tasks?` with an "Apply" confirm label.
- Confirming calls the existing `applyBulk` handler unchanged; cancelling leaves
  the selection untouched. A successful update clears the row selection as
  today. `ConfirmDialog`'s `loading` reflects an in-flight mutation.
- The `DatePicker` keeps a local draft: picking a date or adjusting the time
  updates only the control. `Done` routes the committed value through the same
  confirmation dialog as the other actions; closing without `Done` discards the
  draft. The picker stays open until `Done`, `Esc`, or an outside click.
- The existing "N selected" text remains beside the trigger. The trigger label
  stays "Bulk actions".
- The earlier "clear button" and "destructive styling" requirements are dropped:
  no destructive bulk action exists and a clear button is meaningless on a
  trigger that applies and closes.

### Keyboard and accessibility

- Follow Base UI and native combobox semantics: Arrow keys move, Enter selects,
  Esc closes, and Backspace/Delete removes a chip **when that chip has focus**
  (reachable from the input with Left Arrow).
- Do not implement custom "Backspace removes the last chip" behaviour.
- Every input has a translated `aria-label`; chips and their remove buttons have
  translated names; `ComboboxEmpty` renders "No results found."; group headings
  use `ComboboxLabel`.

### Loading and labels

- No first-class `loading` prop. No call site fetches options independently —
  Tasks and Users come from one query — so callers may compose
  `ComboboxStatus`/`ComboboxEmpty` with `aria-busy` if that changes.
- The primitive takes translated children and `aria-label`s, not a `labels`
  object. Add en/vi keys for: no results, remove chip, bulk actions, apply,
  and the confirm title/body.

## Component API

```tsx
import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "@workspace/ui/components/combobox"
```

- `Combobox`: Base UI Root props (`items`, `multiple`, `value`,
  `onValueChange`, `defaultValue`, `disabled`, `open`, `onOpenChange`,
  `filter`, `autoHighlight`, `itemToStringLabel`, …).
- `ComboboxContent`: `Popup` props plus `align`, `alignOffset`, `side`,
  `sideOffset`.
- `ComboboxInput`, `ComboboxChips`, `ComboboxChip`, `ComboboxChipRemove`,
  `ComboboxValue`, `ComboboxClear`, `ComboboxStatus`, `ComboboxGroup`,
  `ComboboxLabel`, `ComboboxItem`, `ComboboxItemIndicator`,
  `ComboboxSeparator`, `ComboboxTrigger`, `ComboboxIcon`: pass-through to the
  corresponding Base UI part.
- `ComboboxLabel` is Base UI's `GroupLabel`, not the form-level `Root.Label`.

## Testing

- `packages/ui/src/components/combobox.test.tsx`: single-select, multi-select
  chips, filtering, Arrow/Enter/Esc, chip removal, empty state, disabled,
  clear, controlled and uncontrolled.
- `packages/ui/src/components/combobox.stories.tsx`: single, multi with chips,
  grouped actions, disabled, and empty stories, with `play` interactions for
  the main flows; title `Primitives/Combobox`, `tags: ["autodocs"]`.
- `apps/web/test/task-bulk-actions.test.tsx`: grouped selection, confirmation,
  cancel, and the drafted DatePicker confirmation flow.
- `apps/web/e2e/tasks-filters.spec.ts`: update listbox/`option` role queries;
  add multi-select URL and API scenarios and the bulk confirmation flow. Keep
  the date-filter scenarios.
- `packages/api/test/smoke.test.ts`: repeated `status`/`priority`/`assignee`
  filters and the unassigned-OR semantics.

Commands:

```sh
pnpm --filter @workspace/ui test
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter @workspace/api test
pnpm --filter web test:e2e
```

## Acceptance Criteria

- [ ] `Combobox` (single- and multi-select) is exported from the UI package,
      has colocated tests and stories, and is documented by autodocs.
- [ ] Tasks filters (Status, Priority, Assignee) support multiple values; the
      URL uses comma-joined values and the API receives repeated params.
- [ ] Users Role filter uses a single-select `Combobox`; empty means all.
- [ ] No "All" item remains in any migrated filter; placeholders read "All".
- [ ] Chips wrap and each has a working remove button; the Tasks toolbar clear
      resets all filters, and the Users Role field offers a labelled clear.
- [ ] Bulk actions use one grouped, searchable `Combobox`; every discrete
      action, including "Clear due date", goes through the confirm dialog.
- [ ] The bulk `DatePicker` drafts the value, stays open until `Done`, and
      applies only after the shared confirmation dialog.
- [ ] Keyboard-only operation works for both filter fields and bulk actions,
      following Base UI chip semantics.
- [ ] No regressions in pagination, due-date filters, selection reset, or bulk
      partial-failure reporting.
- [ ] `openapi.yaml` and the generated types are updated; mock and smoke tests
      cover multi-value filtering.

## Consequences

- `dropdown-menu.tsx` remains for the sidebar but is no longer used by bulk
  actions.
- `select.tsx` remains for forms, the inline Role editor, and page-size
  selection, but no filter bar uses it.
- The Users Role filter stays a scalar param; only Task filters become arrays.
- The existing e2e role queries change from `menuitem` to `option`; this is a
  test-visible breaking change that lands with the migration.
