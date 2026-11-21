# Follow-up issues

> **Status:** filed in `phuclecong/template-reactjs` on 2026-11-21. GitHub is the source of truth; this file is a reference copy of the filed bodies.
>
> **Updated 2026-11-21:** all eight issues are closed. The parent body and the deferred sections below are kept as filed; the deferred sections carry a **Resolution** note recording what shipped. #82 landed in PR #86; #83 ships in PR #94.

- Parent: #75 (open; all children closed)
- #76 — Users clear-button key — **closed**
- #77 — Filter conversion seam — **closed**
- #78 — Users migration (blocked by #77) — **closed**
- #79 — Role policy module — **closed**
- #80 — Typed locale dictionary — **closed**
- #81 — Due-date boundary module — **closed**
- #82 — Shared table shell — **closed; adopted in PR #86 (ADR-0015)**
- #83 — Shared bulk-action lifecycle — **closed; implemented in PR #94 (ADR-0019)**

---

## Parent

**Title:** Architecture review follow-through (2026-11-21)

**Body:**

Tracks the adopted follow-through from the 2026-11-21 architecture review (`docs/architecture-review/architecture-review-20261121-063109.md`). The review's figures were independently re-derived; see its **Verification corrections** section before relying on the rankings.

### Adopted test

Share an abstraction when it removes a duplicated **rule** that can drift. Parallel structure needs a third consumer and proven escape hatches.

### Order

0. Users clear-button translation key (standalone bug)
1. Filter conversion seam — `CrudFilter[]` ↔ bar values
2. Users migration off `useTableState`/`DataTable`
3. Role policy module
4. Typed locale dictionary
5. Due-date boundary module
6. *(deferred)* Shared table shell — trigger: three tables on the shared path + escape-hatch prototype
7. *(deferred)* Shared bulk-action lifecycle — trigger: a third bulk-action resource

### Acceptance gate

Every item pins current behaviour with tests before refactoring, preserves UX, and counts line deletion only after the suite is green.

Sub-issues carry the per-item scope and acceptance criteria.

**Current status (2026-11-21):** all eight items are closed. The order above is the filed plan, kept as history.

---

## 0. Users clear-button key

**Title:** fix(web): Users filter bar renders the raw key "tasks.filters.clear"
**Labels:** `bug`, `ready-for-agent`
**Parent:** tracking issue

**Body:**

`apps/web/src/features/users/components/users-filter-bar.tsx:45` calls `t("tasks.filters.clear")`, but the `tasks` namespace defines only `filters.clearAll` (`apps/web/src/utils/translations/en.ts:102`). i18next has no fallback strings configured, so the button renders `tasks.filters.clear` in both locales.

### Fix

Use the existing `common.clear` key (`en.ts:10`, `vi.ts:9`), which is already used by `task-form-drawer.tsx:319` and `tasks-bulk-edit-sheet.tsx:273`.

### Acceptance

- Add a regression test in `apps/web/test/users-filter-bar.test.tsx` asserting the clear button renders `Clear` (en) and `Xóa` (vi), not the key.
- `pnpm --filter web test` green.

This is standalone; it does not wait for the typed-locale work.

---

## 1. Filter conversion seam

**Title:** refactor(shared-lib): one descriptor for filter conversion and chip derivation
**Labels:** `ready-for-agent`
**Parent:** tracking issue

**Body:**

Review candidate 1, reduced to the verified duplication.

### What already exists

`createTableUrlAdapter` (`packages/shared-lib/src/hooks/url-table-state.ts`) already owns URL ↔ `CrudFilter[]` for both tables. Do not re-do it.

### Scope

The duplicated half is `CrudFilter[]` ↔ filter-bar values:

- `apps/web/src/features/roles/utils/filters.ts` (`roleFiltersFromCrud`, `roleFiltersToCrud`, `clearRoleFilter`, `readLeafFilter`, `readStatusFilter`, `toLocalDateOnly`)
- `apps/web/src/features/tasks/utils/filters.ts` (`taskFiltersFromCrud`, `taskFiltersToCrud`, `clearTaskFilter`, `readLeafFilter`, `readMultiFilter`, `toLocalDateOnly`)
- Both filter bars' hand-built chips

Verification found 91 byte-identical helper lines plus ~56 parallel operator/date blocks, and the date/operator semantics encoded twice: once in the URL adapter and once per feature.

### Interface

- One descriptor per filter, declared in each feature's `url-state.ts` (the existing declaration gains whatever the bar direction needs: `fromParam`/`toParam`, value formatter, chip copy formatter).
- New pure module in `packages/shared-lib` (e.g. `src/utils/table-filters.ts`) consuming that descriptor:
  - `fromCrud(descriptors, crud)`
  - `toCrud(descriptors, values)`
  - `clear(descriptors, values, param)`
  - chips derived from descriptors + values, with copy supplied by the feature (keep `shared-lib` i18n-free)
- Bars stay hand-written and keep `{ filters, onChange }`. Do **not** generate controls and do **not** extract a shared chip container.

### Date rule

Calendar-validate (`dateOnlyToLocalDate`), not the `isDateOnly` regex. An invalid or overflowed day (e.g. `2026-02-31`) is **no bound**, never a throw. This replaces Roles' latent `RangeError` path and matches the URL adapter's deep-link behaviour.

### Out of scope

- Users migration (separate issue, blocked by this one)
- Shared table shell
- Shared chip component/container
- Due-date normalizer relocation

### Acceptance

- Behaviour-parity tests first: text `contains`, enum `in`/`eq`, multi-value order, date `gte`/`lte` start/end of day, clear semantics, `assignee` → `assigneeId`, invalid dates → no bound.
- Existing `packages/shared-lib/test/url-table-state.test.ts`, `apps/web/test/roles-url-state.test.ts`, `apps/web/test/task-filters.test.ts`, and `apps/web/test/tasks-filter-bar.test.tsx` stay green.
- Roles' overflow-date case is covered by a test that would have thrown before.
- No shared-lib dependency on i18n.

---

## 2. Users migration

**Title:** refactor(web): migrate Users onto useTable and the shared URL adapter
**Labels:** `ready-for-agent`
**Parent:** tracking issue
**Blocked by:** filter conversion issue

**Body:**

Review candidate 3, minimal scope.

### Scope

- `apps/web/src/features/users/components/users-table.tsx`: replace `useList` + `useTableState` + `DataTable` with `useTable` + `createTableUrlAdapter`.
- Keep the Users filter bar's scalar contract (`searchValue`, `roleId`, `onClear`); translate inside the table. Do not rewrite it to `CrudFilter[]` and do not add chips/clear-all.
- Delete `packages/shared-lib/src/hooks/use-table-state.ts` and `packages/shared-lib/src/components/data-table.tsx` (and their barrel exports) after the last consumer moves.
- Gain the Roles/Tasks loading/error/empty trio, including inline retry and `EmptyList`.

### Behaviour to preserve

- URL keys `q`, `roleId`, `sort`, `order`, `page`, `pageSize`; server-side pagination; existing member read-only behaviour.
- `apps/web/e2e/users.spec.ts` stays green (or is updated only for intentional differences).

### Tests

- Retarget or delete `apps/web/test/table-loading-skeleton.test.tsx` (it renders `DataTable` directly).
- Keep `apps/web/test/users-filter-bar.test.tsx` green; it pins the scalar contract.
- Add coverage for the Users error + retry path, which does not exist today.

### Out of scope

- Rewriting the Users filter bar
- Shared table shell (deferred; this issue creates its third consumer)
- Bulk actions

---

## 3. Role policy module

**Title:** refactor(api): one role policy module for Administrator and System Role
**Labels:** `ready-for-agent`
**Parent:** tracking issue

**Body:**

Review candidate 7. The API and the client encode the same role policy six times; the client also drifts from server enforcement.

### Copies

- `packages/api/src/data-handlers.ts:537-554` (`systemRoleIds`, `isAdministrator`, `isSystemRole`, …)
- `packages/api/src/service.ts:119` (registration default `rol_member`)
- `packages/api/src/collections.ts:78,88,103,111` (seeds)
- `apps/web/src/features/roles/utils/index.ts:2,5-7` (`SYSTEM_ROLE_IDS`, `isSystemRole`)
- `apps/web/src/providers/access-control-provider.ts:16`
- `apps/web/src/features/tasks/hooks/use-task-rows.ts:48`
- `apps/web/src/features/users/components/users-table.tsx:104`

### Home

Browser-safe export from `packages/api` (e.g. `@workspace/api/policy`, or an addition to the existing `schemas` entry). Both `web` and `shared-lib` already depend on `api`; `shared-lib` would create a cycle and `ui` is a design-system boundary.

### Surface

Constants and pure predicates only:

- `ADMIN_ROLE_ID`
- `SYSTEM_ROLE_IDS`
- `isAdministratorRole(roleId)`
- `isSystemRole(roleId)`

API guards and the access-control provider stay adapters over it. Do not absorb the access matrix or task ownership.

### Client drift to fix

The API rejects deactivating a System Role (`data-handlers.ts:711`, bulk `:833`) and deleting one (`:738`, bulk `:878`), but the client only hides Delete (`roles-table.tsx:205`). The edit drawer and bulk edit can still submit `inactive`, which the API rejects with `409 system_role`. Use the shared predicate to disable/omit the inactive option for System Roles in the single edit flow and to surface the existing per-item failure in bulk edit.

### Out of scope

- Route gating / access matrix
- Task ownership (admin-or-assignee)
- Renaming seeded Roles

### Acceptance

- No non-test `rol_admin` / `rol_member` literals remain outside the policy module.
- API enforcement unchanged; authorization tests stay green.
- A client test covers the System Role deactivation guard.

---

## 4. Typed locale dictionary

**Title:** feat(web): type the locale dictionary with i18next CustomTypeOptions
**Labels:** `ready-for-agent`
**Parent:** tracking issue

**Body:**

Review candidate 6, type gate only.

### Scope

- Add an i18next `CustomTypeOptions` augmentation (e.g. `apps/web/src/types/i18next.d.ts`) with `defaultNS: "translation"` and `resources.translation` derived from `apps/web/src/utils/translations/en.ts`.
- Missing or renamed keys become typecheck errors.
- Keep the client-side `Locale` resolution unchanged (ADR-0004).

Do **not** merge the duplicated Task/Roles namespaces or delete duplicate label values as part of this issue; that is structural dedupe and is deferred.

### Acceptance

- `pnpm typecheck` passes with the existing dictionary.
- A deliberately wrong key fails typecheck.
- The missing `tasks.filters.clear` key would have been caught (fixed separately).

---

## 5. Due-date boundary module

**Title:** refactor(date-utils): own the local-day ↔ UTC-instant boundary
**Labels:** `needs-triage`
**Parent:** tracking issue

**Body:**

Review candidate 5. The same rule is normalized in two packages and converted in four more, and the copies disagree on invalid input.

### Current duplication

- `packages/api/src/dates.ts` — `normalizeStoredDueDate`, `normalizeDueDateInstant`
- `packages/ui/src/lib/date.ts` — `normalizeLegacyDateValue`, `toUtcInstant`, `localStartOfDayUtcInstant`, `localEndOfDayUtcInstant`
- `packages/shared-lib/src/hooks/url-table-state.ts` — `toLocalDateOnly`, date-range bounds
- `apps/web/src/features/tasks/utils/{filters,task-schema}.ts`
- `apps/web/src/features/roles/utils/filters.ts` — same helpers for `createdAt`/`updatedAt`

`packages/date-utils` (36 lines) currently exports only `isDateOnly` and `parseLocalDateOnly`, and both API and UI already depend on it.

### Scope

Deepen `date-utils` to own the read/write normalizers and the local start/end-of-day conversion, then make the API and UI adapters delegate. Keep display formatting in `ui`; the API must not import `ui`.

### Invalid input

Agreed rule (already applied to table filters): calendar-validate; invalid or overflowed date-only becomes `null`/no bound, never a throw. Today the API returns `null` for `2026-02-31` while the UI throws `RangeError`; no test pins either. Unify on the non-throwing behaviour and add the test.

### Open questions for triage

- Exact `date-utils` export names and whether `ui` re-exports them for existing callers.
- Whether the write path keeps rejecting raw date-only payloads (current `dueDateWriteSchema`) while the write normalizer returns `null` for them.

### Acceptance

- One implementation of the read/write normalizers and the day boundaries.
- `packages/api/test/dates.test.ts` and `packages/ui/src/lib/date.test.ts` green, plus overflow coverage.
- ADR-0007's rule is visibly enforced in one place; amend ADR-0007 if the write-path wording changes.

---

## 6. Deferred: shared table shell

**Resolution (2026-11-21):** adopted in #82 / PR #86 once the third consumer existed and all five escape hatches were proven. `useTableShell` owns the URL seed/mirror, `useTable` wiring, server pagination, and page-scoped selection; `TableShellView` owns the loading/error/empty/grid/pagination states; `createSelectionColumn` owns the checkbox cells. `refineCore` and `reactTable` are returned untouched. Recorded in ADR-0015's #82 amendment; the escape-hatch proofs are in `apps/web/test/table-shell.test.tsx`.

**Title:** deferred: shared table shell (review candidate 2)
**Labels:** `needs-triage`
**Parent:** tracking issue

**Body:**

Not scheduled. Revisit only when both conditions hold:

1. Three tables use the shared path — Roles and Tasks today, Users after its migration.
2. A prototype proves escape hatches for:
   - `enableRowSelection` as `boolean | ((row) => boolean)`
   - Roles-only column visibility
   - overlay/delete strategy (imperative ref + confirm vs `useDialog` + lazy drawers)
   - skeleton column widths
   - empty-state behavior

ADR-0015's rejection of a shared `useTable` wrapper stays in force until this issue is resolved. If adopted, the shell must expose `refineCore` and `reactTable`.

Verification measured 187 contiguous identical lines (40.8%), 249 after normalizing resource names (53%), and 106/117 lines (91%) of the state/URL/pagination/selection core shared.

---

## 7. Deferred: shared bulk-action lifecycle

**Resolution (2026-11-21):** implemented ahead of the third-consumer trigger at the maintainer's direction; the gate was **waived, not met** (ADR-0019). `useBulkActions` composes Refine's `useCustomMutation` and `useInvalidate`; `useClearIntent` owns the sheets' explicit-clear sentinel. Roles and Tasks are thin feature configs.

The parameterization points listed below landed as:

- **Endpoints and payload shape** — `update.url` / `method` / `values`, plus an optional `delete` block. Defaults: `PATCH { ids, ...patch }`, `POST { ids }`.
- **Failure vocabulary** — `reasons` + `keyPrefix`; known reasons are translated, unknown reasons print raw.
- **Selection gating** — not duplicated in the lifecycle. `useTableShell`'s `enableRowSelection` keeps the Roles boolean permission and the Tasks per-row `canModifyTask` predicate; the hook consumes the already-gated list.
- **Analytics payload** — `event` plus update-only `trackData(patch)`; Tasks supplies the changed `fields`.
- **Delete presence and `isApplying`** — overloads make `bulkDelete` required with a `delete` config and `bulkDelete?: undefined` without one; `isApplying` ORs only the configured mutations.

Tests: `apps/web/test/bulk-actions.test.tsx` (module), `apps/web/test/use-clear-intent.test.tsx` (sentinel), plus the feature pins in `roles-bulk-actions.test.tsx` and `tasks-bulk-actions.test.tsx`. Published for review as PR #94.

**Title:** deferred: shared bulk-action lifecycle (review candidate 4)
**Labels:** `needs-triage`
**Parent:** tracking issue

**Body:**

Not scheduled. Revisit only when a third bulk-action resource exists; Roles and Tasks alone do not justify it.

Verified duplication: ~66 identical lines in the update lifecycle (90 across the full hooks), Roles repeats notify → invalidate for delete, and both sheets copy the dirty-sentinel logic.

Any shared module must parameterize:

- endpoints and payload shape (`roles/bulk`, `roles/bulk-delete`, `tasks/bulk`)
- failure vocabulary (Roles: `not_found | system_role | referenced | validation`; Tasks: `not_found | forbidden`)
- selection gating (resource-level vs per-row predicate)
- analytics payload (Tasks adds `fields`)
- delete presence and `isApplying` shape
