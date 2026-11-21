# `@workspace/shared-lib` — shared app infrastructure

Reusable, framework-coupled modules that are not part of the design system.
They are app-agnostic (they know nothing about Tasks, Users, or the dashboard)
and must never import from `apps/web`. The one deliberate exception is
`useEnums` in `hooks`: it mirrors the shared API contract's closed value sets
and their app translation key prefixes, so features cannot redeclare either.

## Modules

| Module       | Import                             | What it is                                                                                                                                                                                                  |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components` | `@workspace/shared-lib/components` | `ComboboxFilter` (with its `FilterOption` type), `DateRangeFilter`, the presentational `EmptyList` and `ErrorPanel` list states, and the shared `TableGrid` / `TablePagination` / `TableSkeleton` rendering |
| `hooks`      | `@workspace/shared-lib/hooks`      | `createTableUrlAdapter` for flat URL ↔ Refine table state, `useEnums()` translated enum choices derived from the API contract, `useDialog` dialog state                                                     |
| `utils`      | `@workspace/shared-lib/utils`      | Small shared utilities (`debounce`, `parseFilterValues` / `joinFilterValues`, descriptor-driven `fromCrud` / `toCrud` / `deriveChips`)                                                                      |

## The boundary rule

`packages/shared-lib` must stay app-agnostic: it **must not import from
`apps/web`**. This is enforced by `no-restricted-imports` in
`packages/shared-lib/eslint.config.js`. Domain-specific code (Tasks, Users)
lives in `apps/web`; presentational primitives live in `packages/ui`.

## Layout

| Directory         | What lives there                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/components/` | Reusable React components (`TableGrid`, `TablePagination`, `TableSkeleton`, `DateRangeFilter`, `EmptyList`, `ErrorPanel`) |
| `src/hooks/`      | Reusable React hooks (`createTableUrlAdapter`, `useEnums`, `useDialog`)                                                   |
| `src/utils/`      | Framework-agnostic utilities (`debounce`, filter conversion)                                                              |

Each directory exposes its public API through an `index.ts`, paired with a
matching entry in `package.json` `exports` (e.g.
`"./hooks": "./src/hooks/index.ts"`).
