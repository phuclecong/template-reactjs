# shadcn `base-nova` is the source of truth; vendored files are not edited

**Status**: accepted

The design system is shadcn's `base-nova` style (Base UI + Tailwind v4), and the
registry output is authoritative for every component the registry ships: API,
markup, and behaviour. Vendored primitive files in `packages/ui/src/components/`
are treated as unedited generated code; visual deviation from stock shadcn lives
only in `packages/ui/src/styles/globals.css`, as tokens plus one documented
`data-slot`-keyed override block. Repo-owned compositions are allowed only where
the registry ships no component (date pickers, confirm dialog, `DataTable`), and
must be built from registry primitives. Chosen because the template's purpose is
to stay a faithful, upgradable shadcn reference, while the current compact look
survives as theme rather than as edits scattered through every file.

## Considered Options

- **Edit vendored files in place** (the de facto state before this decision):
  convenient, but every future `shadcn diff` is a manual merge and drift is
  invisible. Rejected.
- **Accept stock shadcn visuals wholesale**: simplest, but it discards the
  template's deliberate compact density and contradicts the no-regression goal.
  Rejected; individual visual deltas may still be accepted when a theme override
  cannot preserve the current look.
- **Fork the registry**: removes the ability to consume upstream fixes. Rejected.
- **Switch to the Radix style**: a second full migration touching every primitive
  with no functional gain. Rejected.

## Consequences

- Additions run from `packages/ui` with `style: "base-nova"`. The `apps/web`
  `components.json` mirrors the aliases for CLI resolution and must stay in sync.
- Primitives import `cn` from the `cn` package, because that is what the registry
  emits; `packages/ui/src/lib/utils.ts` stays as the configured alias and
  re-export.
- Upgrades are reviewed with `shadcn add <item> --dry-run` (or `--diff`), which
  the pinned CLI supports; a local edit inside a vendored file is a bug, not a
  customization.
- Two deliberate exceptions are excluded from the unedited check:
  `hooks/use-mobile.ts` keeps the repo's coarse-pointer check (the CLI would
  overwrite it with width-only `matchMedia`), and the repo-owned compositions
  (`DatePicker`, `DateRangePicker`, `ConfirmDialog`, `calendar-focus.tsx`) are
  maintained outside the vendored set.
- Behaviour that the registry does not provide (SPA sidebar cookie restore, the
  `paginationItems` window helper, the `toast` re-export) lives in a repo-owned
  seam that composes the primitive, never inside it.
- Density, radius, focus-ring width, and palette changes are CSS. Adding a
  component no longer requires restyling its file.
