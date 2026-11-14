# Skills — how to use them

Skills are packaged instructions for Claude Code: a focused recipe the agent follows when a task matches. They live in [`.claude/skills/`](../.claude/skills/) at the repo root, so they're available in every agent session in this repo.

This page show you how to _drive_ the three CRUD skills — `create-table`, `create-form`, and `create-dialog`.

## Two ways to use a skill

1. **Just say what you want** — the agent matches your request against each skill's description and loads the right one automatically. "Add a users table" reaches for `create-table`; you don't have to name it.
2. **Type the slash command** — `/create-table`, `/create-form`, or `/create-dialog` — when you want to force the choice.

Both routes end in the same place: the agent reads the skill and follows its steps. Use natural language most of the time; reach for the slash command when a request is ambiguous and you want to pin down which recipe runs.

## The one mental model: a resource

Everything these skills build hangs off a **resource** (a task, a user, …). One resource usually means three pieces of UI that work together:

| Piece         | Skill           | What it is                                                                                   |
| ------------- | --------------- | -------------------------------------------------------------------------------------------- |
| The list      | `create-table`  | Server-paginated, sortable, filterable, URL-driven `DataTable`                               |
| Create / edit | `create-form`   | react-hook-form + zod form, in a dialog or inline                                            |
| Confirmations | `create-dialog` | A modal shell — composable registry `Dialog` parts, or the repo-owned `ConfirmDialog` for a forced decision |

So "add a users feature" is rarely one skill. It's a table (list), a form (create/edit), and a dialog or two (the form's shell + a delete confirmation). Say it plainly and the agent will pull in all three at the seams where they meet.

## Every skill starts with discovery

All three skills open the same way: **analyze, then interview**, before any code is written.

- **Analyze** — the agent reads `GLOSSARY.md`, the ADRs that touch the area, `docs/agents/domain.md`, and the closest example folder. Repo facts are its job, not yours.
- **Interview** — it calls the `grilling` and `domain-modeling` skills and asks the decisions in rounds. Each question carries a recommended answer, so "yes" accepts it; it only asks what it cannot look up.
- **Record** — resolved terms land in `GLOSSARY.md`, and a hard-to-reverse, surprising trade-off becomes an ADR.
- **Gate** — the step ends when the frontier is empty and you confirm a shared understanding. Implementation starts after that confirmation, never before.

This is the `/grill-with-docs` interview folded into each CRUD skill, so you do not run it separately. A small rework reaches an empty frontier quickly; a new resource takes several rounds.

## What each skill does

### `create-table`

**Produces** a `DataTable` + `useTableState` from `@workspace/shared-lib`, wired server-side: sorting, filtering, and pagination all go through the mock API and live in the URL.

**Before it builds** — settles the resource and route, columns and their source fields, the sortable whitelist, filter-key↔backend mapping, selection and bulk-editable fields, and per-row permissions.

**Say things like:**

- "Add a `projects` table to the dashboard."
- "Rework the tasks table to add a `status` filter."
- "Give the users table a select column and bulk actions."

**What the agent does** — copies the closest existing feature folder rather than inventing:

- **Minimal example** — `apps/web/src/features/users/` (one filter, no selection).
- **Fullest example** — `apps/web/src/features/tasks/` (five filters, selection, bulk actions, dialogs).

It adds a mock list handler in `packages/api/src/data-handlers.ts`, a `utils/` folder with filter option lists and types, a row hook, the table component, a filter bar, bulk actions (only if rows are selected and edited together), the view + route, and English/Vietnamese translations.

**Verify** — the agent runs `pnpm --filter web typecheck`, `pnpm --filter web lint`, and `pnpm --filter @workspace/api test`. Check the resource appears in the sidebar route and that sort, filter, and pagination actually round-trip to the API.

### `create-form`

**Produces** a `react-hook-form` + `zodResolver` form rendered through the `Field` / `FieldLabel` / `FieldError` primitives from `@workspace/ui`.

**Before it builds** — settles create vs edit, each field's type and nullability, which enums reuse contract schemas, dialog vs inline, and the mutation path.

**Say things like:**

- "Add a create/edit form for projects."
- "Turn the login form into a React Hook Form."
- "Add a change-password form to settings."

**Two shapes**, matched to the closest example:

- **Dialog form** (create/edit) — `apps/web/src/features/tasks/components/task-dialogs.tsx` (`TaskFormDialog`).
- **Inline form** (no dialog) — `apps/web/src/features/auth/components/login-form.tsx` or the settings `ChangePasswordForm`.

**What the agent does** — builds a zod schema (localized via `useMemo(..., [t])`), one `Controller` per field, then wires **submit** to one of three mutation paths: resource (`useCreate`/`useUpdate`), auth (`useLogin`/`useRegister`), or a custom endpoint (`useCustomMutation`). Mutations invalidate the list so the table refreshes.

**Verify** — `pnpm --filter web typecheck` and `pnpm --filter web lint`. Fill the form and confirm validation messages, the empty→null handling for optional fields, and the success/error notifications.

### `create-dialog`

**Produces** a controlled modal driven by `useDialog`, built from one of two `@workspace/ui` shapes:

- `ConfirmDialog` — the repo-owned forced-choice composition over the registry `AlertDialog` parts. It keeps the same desktop API (`open`, `onClose`, `title`, `description`, `confirmLabel`, `cancelLabel`, `tone`, `loading`, `onConfirm`), renders `role="alertdialog"`, and has no dismiss path: Escape and outside clicks are rejected, and Cancel/Confirm are the only exits. Use it for destructive/irreversible actions like delete.
- Composable `Dialog` parts — the registry's `Dialog` root plus `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, and `DialogClose`. The root is controlled (`open` / `onOpenChange`); Escape, the backdrop, and the header close button are safe dismissals. Use this when backing out is harmless, e.g. a form the user can abandon.

The composable parts replace the old `{ open, onClose, title }` wrapper; there is no single import that takes a title/children anymore. Compose the parts instead of rendering raw modal markup.

**Before it builds** — settles the trigger and parent state owner, dismissable vs forced-choice, the content and whether it spans `create-form`, reopen behaviour, and mutation ownership.

**Say things like:**

- "Add a delete confirmation to the users table."
- "Open the task form in a dialog."
- "Rework the edit dialog to reset when reopened."

**What the agent does** — holds `useDialog` in the parent (the table), wires a trigger button to `open(row)`, renders the shell, and keeps a confirmation's mutation at the call site. It keys mount-only content by `useDialog.version` so a reopened dialog re-reads its data.

**Verify** — `pnpm --filter web typecheck` and `pnpm --filter web lint`. Check the dialog opens for the right row, that a dismissable dialog closes on Escape/the backdrop/Close, and that a confirmation genuinely can't be dismissed with Escape or an outside click.

## How they compose

The skills are built to meet cleanly. Knowing the seams lets you request whole features in one sentence:

- **Table + dialog** — a table's row actions open dialogs. Start with `create-table`; it leaves the edit/delete buttons to be wired to dialogs.
- **Form + dialog** — a create/edit form that opens in a modal is _two_ skills: `create-dialog` supplies the shell and `useDialog` state, `create-form` supplies the fields, validation, and submit mutation. Each skill names the other at the seam, so the agent loads both.
- **Confirmation alone** — a delete confirmation is just `create-dialog` (the `ConfirmDialog`).

## A first feature, end to end

The shortest reliable way to ask for a new resource is to describe it, not the plumbing:

> "Add a `projects` feature: a table on the dashboard with a status filter, a create/edit form in a dialog, and a delete confirmation."

The agent will:

1. Run discovery for the table, dialog, and form: analyze the repo, interview you, and confirm the shared understanding.
2. `create-table` the list (handler, filter bar, view, route).
3. `create-dialog` the two shells (the form's `Dialog`, the delete `ConfirmDialog`).
4. `create-form` the fields inside the form shell.
5. Add `en`/`vi` translations throughout.
6. Run typecheck, lint, and API tests and hand you the result.

You bring the domain facts (field names, which are required, what's filterable); discovery is where they get pinned down before code starts. The agent brings the fixed stack and the closest example to copy.

## Tips

- **Name the resource and its fields.** "A `projects` table with a `status` filter" beats "a table." Anything you leave vague, the discovery interview will ask about before building.
- **Say which shape you want** when it matters: dialog vs. inline form, dismissable vs. forced-choice dialog.
- **Trust the copy, not invention** — every skill points the agent at a closest example folder. If you want a different behavior than the example, say so explicitly.
- **Expect the verification commands** — typecheck, lint, API tests, and a Playwright spec if the resource has one. Red on any of them is a real failure to report, not noise.
