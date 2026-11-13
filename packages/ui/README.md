# `@workspace/ui` — the design system

Domain-agnostic UI primitives for the template dashboard. These are the
lowest-level building blocks: they know nothing about Tasks, Users, or the
dashboard, and they never import from `apps/web`.

## Primitives

Most files in `src/components` are unedited `shadcn add` output for the
`base-nova` style (ADR-0009). Do not edit them; put visual differences in
`src/styles/globals.css`.

| Primitive                                                                                                                                                                                             | Import                                | Built on                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------- |
| Button                                                                                                                                                                                                | `@workspace/ui/components/button`     | Base UI `Button`                    |
| Dialog (`DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, …)                                                                        | `@workspace/ui/components/dialog`     | Base UI `Dialog` (registry parts)   |
| AlertDialog (`AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogMedia`, …) | `@workspace/ui/components/alert-dialog` | Base UI `AlertDialog` (registry parts) |
| Input                                                                                                                                                                                                 | `@workspace/ui/components/input`      | Base UI `Input`                     |
| Textarea                                                                                                                                                                                              | `@workspace/ui/components/textarea`   | native `<textarea>`                 |
| Select                                                                                                                                                                                                | `@workspace/ui/components/select`     | Base UI `Select`                    |
| Table (+ `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableFooter`, `TableCaption`)                                                                                             | `@workspace/ui/components/table`      | native table elements               |
| Field (`FieldLabel`, `FieldDescription`, `FieldError`, …)                                                                                                                                              | `@workspace/ui/components/field`      | native `<div>` / `<label>` / `<p>`  |
| Toaster                                                                                                                                                                                                 | `@workspace/ui/components/sonner`     | sonner                              |
| `toast` (imperative API)                                                                                                                                                                                | `@workspace/ui/lib/sonner`            | sonner (repo-owned re-export)       |

Every primitive forwards native props, so it drops into plain `<form>`/table
usage without an adapter. Shared tokens live in `src/lib`:

- `lib/utils.ts` — `cn` (compiled Tailwind class merging).

## Repo-owned, non-registry parts

The registry ships no component for these, so they live here as compositions of
registry primitives. They may be edited, but they must keep composing registry
primitives and Base UI parts; do not hand-roll interactive markup that a
primitive already owns.

| Part                | Import                                              | Composes                                                                                           | Notes                                                                       |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| DatePicker          | `@workspace/ui/components/date-picker`              | `Popover`/`PopoverContent`, `Sheet`/`SheetContent`, `Calendar`, `Button`, Base UI `Dialog.Trigger` | Date + time, locale-aware, mobile sheet variant.                            |
| DateRangePicker     | `@workspace/ui/components/date-range-picker`        | `Popover`/`PopoverContent`, `Sheet`/`SheetContent`, `Calendar`, `Button`                           | Range selection with presets; mobile sheet variant.                         |
| ConfirmDialog       | `@workspace/ui/components/confirm-dialog`           | Registry `AlertDialog` parts                                                                        | Forced explicit choice: no close button, Escape and outside clicks rejected. |
| `DataTable`         | `@workspace/shared-lib/components`                  | `Table`, `Pagination`, `Select` from `@workspace/ui`                                                | Generic table infrastructure in `shared-lib`, not a migration target.       |

## Repo-owned seams

These support the vendored primitives without editing them.

- **`src/components/calendar-focus.tsx`** — `FocusableCalendarDayButton`, the
  shared focus seam for both date pickers. Registry 4.23.0's
  `CalendarDayButton` defines a ref for its keyboard-focus effect but never
  attaches it; the seam forwards a ref through the component's prop spread so
  Arrow-key navigation moves DOM focus. Pass it as `components={{ DayButton }}`
  when composing a `Calendar`.
- **`src/lib/pagination.ts`** — `paginationItems(current, total)`, the page
  window helper. The registry's `pagination.tsx` ships only the visual parts;
  `DataTable` imports the helper from here, so the vendored file stays verbatim.
- **`src/lib/sonner.ts`** — re-exports `toast` from `sonner`. The vendored
  `sonner.tsx` primitive exports only `Toaster` and no longer overrides the
  app's `position`; the app mounts `<Toaster position="bottom-right" …>`.
- **`src/hooks/use-mobile.ts`** — deliberate deviation from the registry: it
  reports mobile when the viewport is narrow **or** the primary pointer is
  coarse, so wide touch devices get the sheet layout. Re-adding the components
  overwrites this file; restore it after every registry run.

## Composing dialogs

`dialog.tsx` and `alert-dialog.tsx` are unedited shadcn `base-nova` registry
output, so they expose the registry's composable parts rather than a single
`{ open, onClose, title }` wrapper. Compose them; do not hand-roll modal chrome
and do not edit the vendored files (see ADR-0009).

- **Dismissable dialog** — controlled `<Dialog open onOpenChange>` containing
  `<DialogContent>`, `<DialogHeader>` with `<DialogTitle>` (and optional
  `<DialogDescription>`), the body, and `<DialogFooter>`. Escape, the backdrop,
  and the header close button all report `onOpenChange(false)`; return focus is
  handled by Base UI.
- **Forced decision** — use the repo-owned `ConfirmDialog`, a composition over
  the registry `AlertDialog` parts. Its API stays `{ open, onClose, title,
  description?, confirmLabel, cancelLabel, tone?, loading?, onConfirm }`. It
  renders `role="alertdialog"`, traps focus, has no close button, and ignores
  outside clicks (Base UI does that for alert dialogs) and Escape (the
  composition cancels the `escape-key` change reason, because the registry
  primitive still dispatches it). Cancel calls `onClose`; Confirm calls
  `onConfirm` and is disabled while `loading` — the caller closes when its
  mutation settles.
- Compose the registry `AlertDialog` parts directly only for a custom
  forced-choice layout; keep the same explicit-choice guarantees in that
  composition.

## The boundary rule

`packages/ui` must stay domain-agnostic: it **must not import from
`apps/web`**. This is enforced by `no-restricted-imports` in
`packages/ui/eslint.config.js` (and by the fact that `@/` — the app alias —
does not resolve here). Feature components that compose the primitives live in
`apps/web/components`.

## Adding a primitive

Registry components are generated, not hand-written. From `packages/ui`:

```bash
pnpm dlx shadcn@4.23.0 add <name> --overwrite --yes
```

Use the canonical batch only when reconciling the existing set (the client
directives depend on batch composition):

```bash
pnpm dlx shadcn@4.23.0 add \
  button input textarea label checkbox select combobox field input-group \
  calendar popover dropdown-menu collapsible separator avatar skeleton dialog \
  alert-dialog sheet sonner sidebar breadcrumb pagination table tooltip \
  --overwrite --yes
```

Then:

1. Restore `src/hooks/use-mobile.ts` (the CLI overwrites the coarse-pointer
   deviation; see above).
2. Do **not** run Prettier on generated files.
3. Add `src/components/<name>.stories.tsx` under `Primitives/` with
   `tags: ["autodocs"]` and, for interactive primitives, a `play` function.
4. Put any visual difference in `src/styles/globals.css`, keyed on `data-slot`
   and naming the component and reason — never in the generated file.
5. Verify the re-run is a no-op with `--dry-run`.

The `./components/*` export map and the Storybook glob pick the new file up
automatically.

## Storybook

```bash
# from the repo root
pnpm storybook           # dev server at http://localhost:6006
pnpm build-storybook     # static build into packages/ui/storybook-static
pnpm --filter @workspace/ui test-storybook:ci   # interaction + a11y gate
```

Every primitive has an autodocs story under `Primitives/*`; interactive
primitives carry `play` functions. `pnpm build` runs `turbo build`; build the
static Storybook separately with `pnpm build-storybook` (CI's storybook job
runs `test-storybook:ci`, which builds it first).
