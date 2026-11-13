# Migrate the UI layer to shadcn/ui

**Status**: implemented on `feat/use-shadcn`; verified by the #27 acceptance audit
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

## 3. Current state (shipped)

- `packages/ui/components.json` and `apps/web/components.json` both exist with
  `style: "base-nova"`, `cssVariables: true`, `iconLibrary: "lucide"`; both alias
  `ui` to `@workspace/ui/components`. `packages/ui` is the canonical CLI location;
  `apps/web/components.json` is the resolution mirror.
- 28 primitive implementation files live in `packages/ui/src/components/` (plus
  the `calendar-focus.tsx` seam). 25 are registry-backed and byte-identical to the
  canonical `shadcn@4.23.0` batch on re-run, except for the documented
  `hooks/use-mobile.ts` deviation; 3 are repo-owned (`date-picker`,
  `date-range-picker`, `confirm-dialog`).
- Registry-backed primitives import `cn` from `cn`, exactly as the registry
  emits; `packages/ui/src/lib/utils.ts` remains the configured alias re-export.
- The compact look lives in `packages/ui/src/styles/globals.css`: palette and
  radius as tokens, then one unlayered `data-slot`-keyed override block. No
  vendored file carries a reintroduced override.
- `Dialog` and `AlertDialog` expose the registry's composable parts; every app
  call site composes them (`task-dialogs.tsx`, both tables, bulk actions), and
  `ConfirmDialog` is a forced-choice composition over the registry
  `AlertDialog`.
- Repo-owned seams that moved out of vendored files: `calendar-focus.tsx` (the
  4.23.0 `CalendarDayButton` focus-ref workaround), `lib/pagination.ts`
  (`paginationItems`), `lib/sonner.ts` (`toast` re-export), and the app-level
  sidebar cookie read in `dashboard-shell.tsx`. `lib/constants.ts` is deleted.
- Stories: all 28 primitives have autodocs stories under `Primitives/*`
  (29 story files counting `Testing/Smoke`); every interactive primitive has a
  `play` function. The non-interactive ones (`avatar`, `breadcrumb`, `separator`,
  `skeleton`, `table`) have none by design.
- Tests: 5 component test files (`button`, `combobox`, `confirm-dialog`,
  `date-picker`, `date-range-picker`) plus 2 logic test files (`lib/date`,
  `lib/pagination`). `DataTable` is covered at the e2e seam.
- Forms are already React Hook Form + Zod + `Field` + `Controller`.
- Dark mode ships: `next-themes` class strategy, Settings buttons, a `d` hotkey,
  and an e2e test that asserts `.dark` persists across reloads. The stale
  "deferred dark-mode" comment is gone.
- CI runs lint → typecheck → test → build → Storybook test-runner, plus a
  separate `e2e (chromium)` job that runs `pnpm --filter web test:e2e`.

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

All rows below have landed: every registry-backed file is now verbatim
`shadcn@4.23.0` output, verified by re-running the canonical batch with
`--dry-run` (only `hooks/use-mobile.ts` reports an overwrite). Reconciliation
runs `shadcn add` from `packages/ui` with the `base-nova` style; do not hand-copy
registry JSON, because the CLI resolves aliases (`@/registry/base-nova/*` →
`@workspace/ui/*`) and icon placeholders. The table records the pre-migration
state and the work that closed it.

| File                | State before this work                 | Work applied                                                                |
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

Supporting files: `hooks/use-mobile.ts` is the registry item's dependency but
keeps its deliberate coarse-pointer check (documented deviation; restore it after
every registry run). `lib/utils.ts` stays as the configured `utils` alias and
re-export. `lib/constants.ts` is deleted, and `SIDEBAR_COOKIE_NAME` now lives
inside the vendored `sidebar.tsx` (write) and `apps/web/src/components/dashboard-shell.tsx`
(read).

### Repo-owned compositions (no registry component exists)

`date-picker.tsx`, `date-range-picker.tsx`, `confirm-dialog.tsx` (the registry
returns 404 for all three). `packages/ui/src/components/calendar-focus.tsx` is a
repo-owned seam that supplies the day button for both pickers. `DataTable` in
`packages/shared-lib` is generic table infrastructure, not a component migration
target. These files may be edited, but they may only use registry primitives and
Base UI parts; they keep their stories and tests, and they are documented in
`packages/ui/README.md` as non-registry.

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

All gates below pass on `feat/use-shadcn` (verified by the #27 audit).

- Every primitive in `packages/ui` has a story under `Primitives/*` with
  `tags: ["autodocs"]` (28 primitive stories, plus `Testing/Smoke`).
- Interactive primitives have `play` functions covering their main flow; the
  Storybook test-runner in CI is the interaction gate.
- Unit tests are required only where logic cannot be expressed as story
  interactions (date/UTC math, pagination windows). There are 5 component test
  files (`button`, `combobox`, `confirm-dialog`, `date-picker`,
  `date-range-picker`) and 2 logic test files (`lib/date`, `lib/pagination`).
- Playwright e2e runs in CI as a separate `e2e (chromium)` job
  (`pnpm test:e2e` with the Chromium browser installed for `apps/web`). All
  existing specs pass unchanged except where a role or label changes with the
  registry API.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
  `pnpm --filter @workspace/ui test-storybook:ci` pass.
- Each PR includes the Storybook light/dark pass over the three dashboard pages
  and login, and lists any accepted visual delta.

## 8. Phases

Each phase landed as its own PR on `feat/use-shadcn`, green before the next
started; all three are merged (guardrails, primitive reconciliation, dialog API
and call sites).

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

All five are fixed and covered by the acceptance checks:

- `sonner.tsx` spread props then hardcoded `position="top-right"`, overriding the
  app's `position="bottom-right"`. The registry file now spreads last and the app
  keeps `bottom-right`; the toast position change is a deliberate functional
  change, listed with the accepted deltas.
- `globals.css` `@source` globs pointed at directories that do not exist; they now
  resolve to `apps/**`, `packages/**`, and `packages/ui/src/**`.
- `cn` was imported two ways across the primitive layer; all 25 vendored files
  import from `cn`.
- The `globals.css` comment claimed dark mode was deferred; it now describes the
  shipped class strategy.
- `packages/ui/src/lib/constants.ts` existed only for the sidebar deviation and is
  deleted.

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
- Toasts coalesce repeated identical notifications. The notification provider
  assigns a stable sonner `id` — Refine's notification `key` when provided,
  otherwise `${type}:${message}` — so a repeated identical notification updates
  the toast already on screen instead of stacking a duplicate. This is a
  deliberate functional change beyond the toast seam, and it keeps e2e
  assertions deterministic.
- Recipes in `docs/skills.md` remain valid, but the dialog recipe changes shape.

## 11. Acceptance criteria

- [x] Every registry-backed primitive is an unedited `shadcn add` output.
- [x] All visual deviation is confined to `globals.css`, and every override rule
      states its component and reason.
- [x] `Dialog` and `AlertDialog` use registry APIs; every call site, the
      `create-dialog` skill, and `docs/skills.md` are updated.
- [x] Repo-owned compositions (`DatePicker`, `DateRangePicker`, `ConfirmDialog`)
      are documented as non-registry and use only registry primitives.
- [x] Every primitive has an autodocs story; interactive primitives have `play`
      functions.
- [x] Playwright e2e runs in CI and all existing specs pass.
- [x] `cn` is imported exclusively from `cn` in `packages/ui/src/components`.
- [x] The `@source` globs, sonner position override, stale dark-mode comment, and
      unused sidebar constants are gone.
- [x] Light and dark passes over Tasks, Users, Settings, and Login show no
      functional or accessibility regressions; accepted visual deltas are listed.

### Accepted visual deltas

Recorded during the light/dark pass and the phase reviews. Each is either a
deliberate consequence of adopting registry semantics that no theme override can
restore, or a composition detail with no functional/a11y regression.

- **Dialog and AlertDialog chrome.** Registry 4.23.0 owns the overlay, content
  padding, footer alignment, and close-button placement; form dialogs are
  narrower (`max-w-xs`, `sm:max-w-sm`). The square radius and compact type still
  come from tokens/theme, but the exact shell differs from the old bespoke
  wrapper. Accepted: the API and a11y (focus trap, Escape/backdrop behaviour) are
  the point of the migration.
- **Pagination layout and active state.** Registry `Pagination*` renders
  Button-based links inside the shared table footer. Page links are square and
  compact (theme-provided), the active page reads as a bordered control rather
  than the old underline, and the "Rows per page" label may wrap at narrow
  widths. Accepted.
- **Select item padding.** Registry 4.23.0 uses `px-1.5 py-1` for select items;
  the compact type comes from the theme but the tighter horizontal padding is
  registry-owned. Accepted.
- **Checkbox indeterminate icon.** The registry/Base UI indicator renders an
  indeterminate dash instead of the previous custom glyph. Accepted.
- **Combobox chip composition.** The registry part surface (`ComboboxChips`,
  `ComboboxChip`, `useComboboxAnchor`) replaces the old 18-part wrapper;
  `ComboboxChipRemove`/`ComboboxClear` are no longer exported. Chip layout and
  removal affordances follow the registry. Accepted.
- **Sidebar mobile-drawer labels (registry-imposed i18n/a11y delta).** Registry
  4.23.0 renders the mobile drawer's `SheetTitle` and `SheetDescription` as
  hardcoded English strings with no app seam, so translating them would require
  editing the vendored `sidebar.tsx` (forbidden by ADR-0009). The header trigger
  label is app-owned and is restored via `aria-label={t("shell.toggleSidebar")}`,
  so the trigger's accessible name is translated; the drawer's screen-reader
  title/description remain English. This is an accepted registry-imposed delta,
  not a pre-existing behaviour.
- **Toast position.** Toasts now honour the app's `position="bottom-right"`
  instead of the vendored file's hardcoded `top-right` — a deliberate
  functional change (§9). Accepted.
- **Toast coalescing.** Repeated identical notifications update a single toast
  instead of stacking; the stable id is Refine's `key` or
  `${type}:${message}` — a deliberate functional change (§10). Accepted.
