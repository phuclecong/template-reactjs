---
name: create-dialog
description: Create or rework a dialog in this repo. Use when the user asks to create, add, or rework a dialog, modal, or confirmation dialog.
---

# Create a dialog

The shell is fixed — every dialog is a controlled modal driven by `useDialog` (state). `Dialog` and `AlertDialog` are unedited registry composable parts, so a dismissable dialog composes the `Dialog*` parts and a forced decision uses the repo-owned `ConfirmDialog` (a composition over the `AlertDialog*` parts). Copy the closest example rather than inventing:

- **Confirmation** — `apps/web/features/tasks/components/task-dialogs.tsx` (`DeleteTaskDialog`) or inline in `apps/web/features/users/components/users-table.tsx`: `ConfirmDialog` (registry `AlertDialog` composition).
- **Dismissable** — `apps/web/features/tasks/components/task-dialogs.tsx` (`TaskFormDialog`): `Dialog` + `DialogContent`/`DialogHeader`/`DialogTitle` wrapping a form.

A dialog that holds a **form** spans two skills: this one for the shell, the create-form skill for the form content.

## Steps

1. **State** — hold `useDialog<T>()` in the parent component that renders the trigger; the row's edit/delete button calls `open(row)`. `open()` with no argument is create mode (`data` stays `null`); `close()` clears `data`. *Done when* it typechecks.

2. **Shell** —
   - **Confirmation** (destructive or irreversible): `ConfirmDialog` with `open`, `onClose`, `title`, `description`, `confirmLabel`, `cancelLabel`, `tone` (`"danger"` default), `loading`, `onConfirm`. It composes the registry `AlertDialog` parts and forces an explicit choice: there is no close button, outside clicks are ignored, and the composition cancels Escape in `onOpenChange` because Base UI still dispatches it. Cancel calls `onClose`; Confirm calls `onConfirm` and is disabled while `loading` (the caller closes when the mutation settles). Use the `AlertDialog*` parts directly only for a custom confirm layout, and keep the same Escape/outside rejection.
   - **Dismissable** (a form or view the user can back out of): compose the registry parts — controlled `<Dialog open onOpenChange>`, `<DialogContent>`, `<DialogHeader>` with `<DialogTitle>` (and optional `<DialogDescription>`), the body, and `<DialogFooter>` with `<DialogClose>`/actions. Escape, the backdrop, and the header close button all report `onOpenChange(false)`. There is no single `{ open, onClose, title }` wrapper anymore.
   *Done when* it typechecks and lints clean.

3. **Content** — a **form** goes inside the shell (create-form skill). A **confirmation** keeps its mutation at the call site — `useDelete<TRecord>({})` mutated with `{ resource, id, invalidates: ["resourceAll"], successNotification, errorNotification }` and `{ onSuccess: close }` — either inline in the parent or in a `<Resource>DeleteDialog` wrapper. *Done when* it typechecks and the delete round-trips against the mock API.

4. **Remount on reopen** — pass `key={version}` from `useDialog` to content whose state is read only on mount (a form's `defaultValues`), so reopening for a different row re-reads it. *Done when* reopening for a second row shows that row's data.

5. **Translations** — add the section to `apps/web/utils/translations/en.ts` and `vi.ts`. `vi` is typed `Translation = typeof en`, so both dictionaries must share every key; drift fails typecheck. *Done when* it typechecks.

6. **Verify** — `pnpm --filter web typecheck`, `pnpm --filter web lint`, and confirm every rule in **Conventions** holds. If the dialog has a Playwright spec, run `pnpm --filter web test:e2e`.

## Conventions

- **Controlled** — the caller owns the open state: the `Dialog` root receives `open`/`onOpenChange`, and `ConfirmDialog` receives `open`/`onClose`. The dialog has no `show()`/`hide()` of its own.
- **State lives in the parent** — `useDialog` is held where the trigger renders (the table), not inside the dialog; the dialog is a pure view of `{ open, data, onClose }`.
- **Create mode is `open()`** — no argument leaves `data` `null`, which the content reads as "new".
- **Compose parts, don't hand-roll** — a dismissable dialog is the registry `Dialog*` parts; never render a bespoke overlay/popup or edit the vendored `dialog.tsx`/`alert-dialog.tsx`.
- **Confirmation has no dismiss path** — `ConfirmDialog` cancels Escape and Base UI's alert dialog ignores outside clicks; use `Dialog` only when backing out is harmless. Do not remove the cancellation or replace it with a plain dialog.
- **`key={version}` remounts** — `useDialog.version` increments on every `open`; keying mount-only content by it resets that content.
- **Mutations invalidate** — mutations set `invalidates: ["resourceAll"]` and use `describeError(error)` for the error notification.
