# Shared bulk-action lifecycle

**Status**: accepted

The 2026-11-21 architecture review (§4, "Collapse the Bulk action lifecycle";
Candidate 4 confirmed) found that the Roles and Tasks bulk hooks each
re-implement the same write pipeline: guard, mutate, notify (including per-row
failure summaries), track, clear the selection, and invalidate the list. About
66 lines of the update lifecycle were identical (the review counted 90
non-blank identical lines across the full hooks), Roles repeated the
notify → invalidate block a second time for delete, and both bulk-edit sheets
copied the explicit-clear sentinel line for line.

The review's adoption test is: share an abstraction when it removes a
duplicated **rule** that can drift; parallel structure needs a third consumer
and proven escape hatches. Spec #83 was filed as deferred for that reason:
"Revisit only when a third bulk-action resource exists; Roles and Tasks alone
do not justify it."

**This gate was waived, not met.** On 2026-11-21 the maintainer chose to
implement #83 ahead of a third bulk-action resource rather than wait. There are
still only two consumers (Roles and Tasks). Future readers must not cite this
ADR as precedent that two consumers satisfy the review's third-consumer test.
The test stands unchanged; a later extraction still needs either a third
consumer or its own explicit waiver.

## Considered Options

- **Keep the feature-local hooks**: no new shared surface, but the duplicated
  lifecycle is policy, not resource adaptation, and the two copies drift
  independently — the failure vocabulary and notification shape are the same
  rule expressed twice.
- **Share only the sheets' explicit-clear sentinel**: removes the smaller copy,
  but leaves the write pipeline duplicated and does not bring toast, analytics,
  failure, and invalidation policy into one place.
- **Use Refine's `useUpdateMany` / `useDeleteMany`**: the natural Refine hooks
  for bulk writes, but the `simple-rest` data provider omits
  `updateMany`/`deleteMany`, so they cannot issue the bulk requests
  (ADR-0015). The endpoints are `PATCH /roles/bulk`, `POST /roles/bulk-delete`,
  and `PATCH /tasks/bulk`; there is no matching provider method.
- **One configurable lifecycle module**: features declare their endpoints,
  vocabulary, analytics extras, and delete presence; the shared module owns the
  pipeline. Chosen.

## Decision

One module, `useBulkActions` in
`packages/shared-lib/src/hooks/use-bulk-actions.ts`, owns guard → mutate →
notify → track → invalidate for every bulk action. Features configure it
instead of copying it. The module composes two existing Refine hooks rather
than replacing them:

- `useCustomMutation` issues the request through the provider's `custom`
  method, so Refine keeps ownership of fetching and notification dispatch.
- `useInvalidate` invalidates the affected list, which `useCustomMutation`
  deliberately does not do on its own.

`useClearIntent` (`packages/shared-lib/src/hooks/use-clear-intent.ts`) is the
companion extraction for the sheets: React Hook Form unsets `dirtyFields` when
a value returns to its default `""`, so the hook records an explicit Clear
separately and folds it into the field-dirty and form-dirty checks.

**Why a custom hook is justified under AGENTS.md.** No Refine core hook covers
this combination. `useCustomMutation` owns the request and notification but
knows nothing about per-row failure summaries, the analytics envelope, or
clearing the selection; `useInvalidate` is a separate concern composed beside
it. `useUpdateMany`/`useDeleteMany` are unusable against `simple-rest` (above).
`useClearIntent` is local form state, not data fetching, so no data hook
applies; composing `useForm` alone cannot distinguish "never touched" from
"explicitly cleared to the default".

## Parameterization

The config keeps the resource-specific parts in the feature and the shared
rule in the module:

- **Endpoints and payloads**: `update.url` / `update.method` /
  `update.values`, and the optional `delete` block with the same shape.
  Defaults are `PATCH` with `{ ids, ...patch }` for update and `POST` with
  `{ ids }` for delete.
- **Translation namespace**: `keyPrefix` (for example `roles.bulk`), used for
  the success, partial-failure, error, per-row failure, and known-reason keys.
- **Failure vocabulary**: `reasons`, so a known reason is translated through
  `keyPrefix.reasons.<reason>` and anything else is shown raw.
- **Analytics payload**: `event` plus update-only `trackData(patch)`, which
  Tasks uses to report the changed `fields`.
- **Delete presence**: a config with `delete` returns a required `bulkDelete`
  and ORs its pending state into `isApplying`; a config without it returns
  `bulkDelete?: undefined`, so Tasks cannot gain a delete action by accident.

**Selection gating is not in this hook.** `useTableShell`'s
`enableRowSelection` already owns the boolean-vs-predicate rule (Roles: a
permission; Tasks: the per-row `canModifyTask` predicate). `useBulkActions`
consumes the resulting already-gated `selected` list, so the rule is not
duplicated and a future resource chooses gating in the shell.

## Consequences

- A new bulk resource configures `useBulkActions` instead of copying the
  pipeline: it provides its endpoint, translation namespace, failure
  vocabulary, analytics extras, and whether delete exists. Its feature hook
  stays a thin wrapper around the module.
- Copy stays in translations. The module emits keys; the feature's
  `en`/`vi` dictionaries keep the wording, so shared-lib carries no English or
  Vietnamese strings.
- The shared-lib boundary is preserved. `useBulkActions` does not import from
  `apps/web`; the app supplies `track` and `describeError` as injected
  functions, keeping observability and HTTP-error policy in the app.
- Partial failures are reported uniformly in both features: when some rows
  fail, the success-notification callback returns an error-typed message
  (`updatedWithFailures` / `deletedWithFailures`) whose description carries one
  line per failed id (title plus translated reason); a clean run reports the
  updated or deleted count.
- The parameterization is validated by only two shapes (update-only and
  update-plus-delete). A third consumer should re-check the config surface
  before adding more knobs.
