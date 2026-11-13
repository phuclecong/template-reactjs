# Migrate the UI layer to shadcn/ui

**Status**: ready for implementation
**Decision records**: `docs/adr/0009-shadcn-vendoring-policy.md`
**Supersedes**: `use-shadcn-component.md` (folded into this spec)
**Related**: `combobox.md`, `date-picker.md`, `layout-sidebar.md`, `shared-lib.md`, `task-table.md`

## 1. Summary

The template already runs on shadcn's `base-nova` style (Base UI + Tailwind v4 +
CSS variables). This work makes the registry the actual source of truth: reconcile
every vendored primitive to the registry output, move the template's compact look
into a single theme layer, migrate the two custom dialog APIs to the registry API,
and close the story, test, and CI gaps. What "migrated" means is defined per file
in the audit table in §5.

## 2. What "migrated" means

Four rules apply to every file:

1. **The registry is authoritative** for the API, markup, and behaviour of every
   component `shadcn add` can produce.
2. **Vendored files are not edited.** All visual deviation from the registry lives
   in `packages/ui/src/styles/globals.css`: tokens first, then one documented
   override block (§6). Registry updates are applied with `shadcn diff` and
   reviewed, never hand-merged.
3. **Repo-owned compositions are allowed** only when the registry ships no
   component. They must be built exclusively from registry primitives and Base UI
   parts, and they count as part of the design system (§5, repo-owned).
4. **Feature components compose primitives.** No feature file may hand-roll
   interactive markup that a primitive already owns (buttons, popups, dialog
   chrome, accessible widgets).

**Visual bar:** no functional or accessibility regressions. Accepting a visual
change is allowed only when (a) the current code departs from registry semantics
and no theme override restores it, or (b) the deviation is deliberate and recorded
in the override block. Every accepted delta is listed in the PR that makes it.

## 3. Current state

- `packages/ui/components.json` and `apps/web/components.json` both exist with
  `style: "base-nova"`, `cssVariables: true`, `iconLibrary: "lucide"`. Both alias
  `ui` to `@workspace/ui/components`.
- 28 primitive implementation files live in `packages/ui/src/components/`.
  25 match registry component names; 3 are repo-owned. All 25 are registry output
  that has been locally restyled: stock registry tokens are `rounded-lg`,
  `text-sm`, `ring-3`, while the repo uses `rounded-none`, `text-xs`, `ring-1`
  and a muted border tone to get a compact look.
- The `base-nova` registry imports `cn` from the `cn` npm package directly and
  declares it as a dependency. `packages/ui/src/lib/utils.ts` re-exports it, but
  it is not the registry's import target.
- Tests: 4 primitive test files (`button`, `combobox`, `date-picker`,
  `date-range-picker`) plus `lib/date.test.ts`.
- Stories: 23 of 28 primitives. Missing: `alert-dialog`, `checkbox`,
  `input-group`, `pagination`, `textarea`.
- Forms are already React Hook Form + Zod + `Field` + `Controller`.
- Dark mode is shipped: `next-themes` class strategy, Settings buttons, a `d`
  hotkey, and an e2e test that asserts `.dark` persists across reloads. The
  "deferred dark-mode toggle" comment in `globals.css` is stale.
- CI runs lint → typecheck → test → build → Storybook test-runner. It does **not**
  run Playwright; all eight e2e specs are local-only.

## 4. Scope

### In scope

- The 25 registry-backed primitives in `packages/ui`.
- The `Dialog` / `AlertDialog` API migration at every call site.
- The theme deviation layer and the stale comment in `globals.css`.
- A story for every primitive, with `play` interactions for interactive ones.
- Playwright e2e in CI.
- `cn` import alignment, `@source` glob repair, and the sonner position defect.
- Docs: this spec, ADR-0009, `docs/skills.md`, the `create-dialog` skill,
  `packages/ui/README.md`, and folding `use-shadcn-component.md`.

### Out of scope

- Fonts, a visual redesign, or any new theme mode. Dark mode already ships.
- Forms: already RHF + Zod + `Field`; no `FormField` wrapper migration.
- Re-homing or rewriting `DataTable` (`packages/shared-lib`).
- Switching registry flavor (Radix) or adding new components.
- Screenshot / visual-regression infrastructure.

## 5. Component audit

### Registry-backed (must match registry output)

Reconcile by running `shadcn add <name>` from `packages/ui` with the `base-nova`
style, then reviewing the diff. Do not hand-copy registry JSON: the CLI resolves
aliases (`@/registry/base-nova/*` → `@workspace/ui/*`) and icon placeholders.

| File                | Current state                          | Work                                                                        |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `button.tsx`        | Wrapper + cva; square, `text-xs`       | Reconcile; radius/typography to theme layer                                 |
| `input.tsx`         | Wrapper; square, `text-xs`             | Reconcile; theme layer                                                      |
| `textarea.tsx`      | Hand-rolled native                     | Replace with registry output                                                |
| `label.tsx`         | Hand-rolled native                     | Replace with registry output                                                |
| `checkbox.tsx`      | Wrapper; square                        | Reconcile; theme layer                                                      |
| `select.tsx`        | Wrapper                                | Reconcile; theme layer                                                      |
| `combobox.tsx`      | Wrapper (18 parts)                     | Reconcile; keep the documented part surface                                 |
| `field.tsx`         | Hand-rolled composition                | Replace with registry output; theme layer                                   |
| `input-group.tsx`   | Hand-rolled composition                | Replace with registry output; theme layer                                   |
| `calendar.tsx`      | `react-day-picker` wrapper             | Reconcile; keep locale/format wiring                                        |
| `popover.tsx`       | Wrapper                                | Reconcile                                                                   |
| `dropdown-menu.tsx` | Wrapper (17 parts)                     | Reconcile                                                                   |
| `collapsible.tsx`   | Wrapper                                | Reconcile                                                                   |
| `separator.tsx`     | Wrapper                                | Reconcile                                                                   |
| `avatar.tsx`        | Wrapper (unused by the app)            | Reconcile; stays in the design system                                       |
| `skeleton.tsx`      | Hand-rolled                            | Replace with registry output                                                |
| `dialog.tsx`        | Custom `{open,onClose,title}` API      | Replace with registry composable parts; breaking call-site change (PR 3)    |
| `alert-dialog.tsx`  | Custom `{open,onClose}` API            | Replace with registry composable parts; breaking call-site change (PR 3)    |
| `sheet.tsx`         | Wrapper                                | Reconcile                                                                   |
| `sonner.tsx`        | Wrapper; hardcoded `position`          | Replace with registry output (exports `Toaster` only; see §6)               |
| `sidebar.tsx`       | Composite; SPA cookie restore          | Reconcile; move cookie restore to the app (§6)                              |
| `breadcrumb.tsx`    | Hand-rolled semantic markup            | Replace with registry output                                                |
| `pagination.tsx`    | Hand-rolled + `paginationItems` helper | Replace with registry output; move `paginationItems` to `lib/pagination.ts` |
| `table.tsx`         | Hand-rolled native, compact            | Replace with registry output; theme layer                                   |
| `tooltip.tsx`       | Wrapper                                | Reconcile                                                                   |

Supporting files: `hooks/use-mobile.ts` is the registry item's dependency but keeps
its deliberate coarse-pointer check (documented deviation). `lib/utils.ts` stays as
the configured `utils` alias and re-export. `lib/constants.ts` is deleted once the
sidebar no longer imports `SIDEBAR_COOKIE_NAME`.

### Repo-owned compositions (no registry component exists)

`date-picker.tsx`, `date-range-picker.tsx`, `confirm-dialog.tsx` (registry returns
404 for all three). `DataTable` in `packages/shared-lib` is generic table
infrastructure, not a component migration target. These files may be edited, but
they may only use registry primitives and Base UI parts; they must keep their
stories and tests, and they are documented in `packages/ui/README.md` as
non-registry.

### Feature files (`apps/web`)

| File                                                 | Work                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `features/tasks/components/task-dialogs.tsx`         | Rewrite `Dialog` usage to registry parts                                                  |
| `features/tasks/components/tasks-table.tsx`          | Rewrite delete `ConfirmDialog` call only if its internals change; no hand-rolled controls |
| `features/users/components/users-table.tsx`          | Same for delete and the inline Role editor                                                |
| `features/tasks/components/task-bulk-actions.tsx`    | Confirm flow uses repo-owned `ConfirmDialog`; no custom popup markup                      |
| `features/tasks/components/task-filters-bar.tsx`     | Audit only; already composes `Combobox`/`InputGroup`                                      |
| `features/users/components/users-filter-bar.tsx`     | Audit only                                                                                |
| `features/auth/components/{login,register}-form.tsx` | Audit only; already `Field` + RHF                                                         |
| `features/settings/index.tsx`                        | Audit only                                                                                |
| `components/dashboard-shell.tsx`                     | Read the sidebar cookie and pass `defaultOpen` (§6)                                       |
| `components/app-sidebar.tsx`                         | Audit only; already composes `Sidebar`/`Collapsible`/`DropdownMenu`                       |
| `providers/notification-provider.ts`                 | Import `toast` from the new repo-owned module (§6)                                        |

## 6. Theme layer and repo-owned seams

### Deviation layer

`globals.css` owns every difference from stock shadcn:

1. **Tokens** — palette, radius, sidebar/chart tokens. Radius is expressed here so
   registry `rounded-*` classes resolve to the template's square look.
2. **One override block** — placed after `@theme inline` and unlayered so it beats
   Tailwind utilities. Keyed on `data-slot` attributes, it restores the compact
   control typography, focus-ring width, and border tone that tokens cannot
   express. Every rule names the component and the reason. No other file may
   reintroduce these overrides.

### Seams that move out of vendored files

- **Sidebar cookie restore.** The registry `SidebarProvider` writes the
  `sidebar_state` cookie but does not read it. Move `readSidebarCookie` into
  `apps/web/src/components/dashboard-shell.tsx` (or a small app hook) and pass
  `defaultOpen`; `DashboardLayout` no longer needs to know about it. Delete
  `packages/ui/src/lib/constants.ts`.
- **`toast`.** Registry `sonner.tsx` exports only `Toaster`. Add
  `packages/ui/src/lib/sonner.ts` with `export { toast } from "sonner"` and import
  it in `notification-provider.ts`. The app keeps passing
  `position="bottom-right"` to `<Toaster>`; the registry file no longer overrides
  it.
- **`paginationItems`.** Move to `packages/ui/src/lib/pagination.ts`; `DataTable`
  imports it from there.

## 7. Testing and done bar

- Every primitive in `packages/ui` has a story under `Primitives/*` with
  `tags: ["autodocs"]`.
- Interactive primitives have `play` functions covering their main flow; the
  Storybook test-runner in CI is the interaction gate.
- Unit tests are required only where logic cannot be expressed as story
  interactions (date/UTC math, URL filter mapping). The existing combobox,
  date-picker, date-range-picker, and date tests stay.
- Playwright e2e runs in CI (`pnpm test:e2e` with the Chromium browser installed
  for `apps/web`). All existing specs must pass unchanged except where a role or
  label changes with the registry API.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
  `pnpm --filter @workspace/ui test-storybook:ci` pass.
- Each PR includes the Storybook light/dark pass over the three dashboard pages
  and login, and lists any accepted visual delta.

## 8. Phases

Each phase lands as its own PR on `feat/use-shadcn`, green before the next starts.

### PR 1 — Guardrails

- Add Playwright e2e to CI.
- Add stories for `alert-dialog`, `checkbox`, `input-group`, `pagination`,
  `textarea`; add `play` interactions to interactive stories.
- Align `cn` imports: `dialog.tsx` and `alert-dialog.tsx` change from
  `../lib/utils` to `cn`, matching the registry and the other 23 files.
- Fix the `@source` globs in `globals.css` (they currently resolve to
  `packages/apps` and `packages/components`, neither of which exists).
- Fix the sonner `position` override.
- Update the stale dark-mode comment.
- Write ADR-0009 and this spec; mark `use-shadcn-component.md` as folded in.

**Exit:** CI green including e2e; every primitive has a story.

### PR 2 — Primitive reconciliation

- Reconcile the 25 registry-backed primitives except `dialog` and `alert-dialog`
  (their API break would leave PR 2 red).
- Build the deviation layer in `globals.css`; delete `lib/constants.ts`; move
  `paginationItems` and `toast` to their new modules; move the sidebar cookie
  restore into `DashboardShell`.
- Update stories/tests for changed markup; run the light/dark visual pass.

**Exit:** registry-backed files are unedited outputs; all suites green; accepted
visual deltas listed in the PR.

### PR 3 — Dialog API and call sites

- Replace `dialog.tsx` and `alert-dialog.tsx` with registry composable parts.
- Rewrite `task-dialogs.tsx`, the delete flows in both tables, and the bulk
  confirmation flow; `ConfirmDialog` becomes a composition over registry
  `AlertDialog`.
- Update `docs/skills.md`, the `create-dialog` skill, and the package READMEs.

**Exit:** no call site uses the removed APIs; docs match the code; e2e green.

## 9. Known defects fixed by this work

- `sonner.tsx` spreads props then hardcodes `position="top-right"`, overriding the
  app's `position="bottom-right"`. The toast position is a deliberate functional
  change, recorded in the PR.
- `globals.css` `@source` globs point at directories that do not exist.
- `cn` is imported two ways across the primitive layer.
- The `globals.css` comment claims dark mode is deferred; it shipped.
- `packages/ui/src/lib/constants.ts` exists only for the sidebar deviation above.

## 10. Consequences

- The `Dialog` and `AlertDialog` exports change shape. This is the migration's one
  breaking API change; the `create-dialog` skill and `docs/skills.md` change with
  it.
- Features that relied on the compact look keep it only through `globals.css`.
  Adding a component no longer means restyling its file.
- Registry upgrades become `shadcn diff` reviews under ADR-0009; local edits will
  show up as conflicts, which is the point.
- `packages/ui` is the canonical place to run `shadcn add`. The `apps/web` config
  stays as a mirror for CLI resolution; its aliases must match.
- Recipes in `docs/skills.md` remain valid, but the dialog recipe changes shape.

## 11. Acceptance criteria

- [ ] Every registry-backed primitive is an unedited `shadcn add` output.
- [ ] All visual deviation is confined to `globals.css`, and every override rule
      states its component and reason.
- [ ] `Dialog` and `AlertDialog` use registry APIs; every call site, the
      `create-dialog` skill, and `docs/skills.md` are updated.
- [ ] Repo-owned compositions (`DatePicker`, `DateRangePicker`, `ConfirmDialog`)
      are documented as non-registry and use only registry primitives.
- [ ] Every primitive has an autodocs story; interactive primitives have `play`
      functions.
- [ ] Playwright e2e runs in CI and all existing specs pass.
- [ ] `cn` is imported exclusively from `cn` in `packages/ui/src/components`.
- [ ] The `@source` globs, sonner position override, stale dark-mode comment, and
      unused sidebar constants are gone.
- [ ] Light and dark passes over Tasks, Users, Settings, and Login show no
      functional or accessibility regressions; accepted visual deltas are listed.
