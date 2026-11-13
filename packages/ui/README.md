# `@workspace/ui` — the design system

Domain-agnostic UI primitives for the template dashboard. These are the
lowest-level building blocks: they know nothing about Tasks, Users, or the
dashboard, and they never import from `apps/web`.

## Primitives

| Primitive                                                                                                                                                                                             | Import                                | Built on                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------- |
| Button                                                                                                                                                                                                | `@workspace/ui/components/button`     | Base UI `Button`                    |
| Dialog (`DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, …)                                                                        | `@workspace/ui/components/dialog`     | Base UI `Dialog` (registry parts)   |
| AlertDialog (`AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogMedia`, …) | `@workspace/ui/components/alert-dialog` | Base UI `AlertDialog` (registry parts) |
| ConfirmDialog (repo-owned)                                                                                                                                                                            | `@workspace/ui/components/confirm-dialog` | composition over registry `AlertDialog` |
| Input                                                                                                                                                                                                 | `@workspace/ui/components/input`      | Base UI `Input`                     |
| Textarea                                                                                                                                                                                              | `@workspace/ui/components/textarea`   | native `<textarea>`                 |
| Select                                                                                                                                                                                                | `@workspace/ui/components/select`     | Base UI `Select`                    |
| Table (+ `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableFooter`, `TableCaption`)                                                                                             | `@workspace/ui/components/table`      | native table elements               |
| Field (`FieldLabel`, `FieldDescription`, `FieldError`, …)                                                                                                                                              | `@workspace/ui/components/field`      | native `<div>` / `<label>` / `<p>`  |
| Toast (`Toaster`, `toast`)                                                                                                                                                                            | `@workspace/ui/components/sonner`     | sonner                              |

Every primitive forwards native props, so it drops into plain `<form>`/table
usage without an adapter. Shared tokens live in `src/lib`:

- `lib/utils.ts` — `cn` (compiled Tailwind class merging).

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

1. Add `src/components/<name>.tsx`, importing `cn` from `"cn"`.
2. Add `src/components/<name>.stories.tsx` with representative stories.
3. That's it — the `./components/*` export map and the Storybook glob pick it
   up automatically.

## Storybook

```bash
# from the repo root
pnpm storybook           # dev server at http://localhost:6006
pnpm build-storybook     # static build into packages/ui/storybook-static
```

`pnpm build` runs `turbo build` **and** `turbo build-storybook`, so the design
system's Storybook is part of the monorepo build.
