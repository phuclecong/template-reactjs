# `@workspace/shared-lib` — shared app infrastructure

Reusable, framework-coupled modules that are not part of the design system.
They carry no domain knowledge (they know nothing about Tasks, Users, or the
dashboard) and must never import from `apps/web`. That does **not** make the
whole package framework-neutral: the table shell is coupled to React Router.
`useTableShell` owns `useSearchParams`, `useNavigate`, and `useLocation` to
seed and mirror the flat URL state (ADR-0016), so it only works inside a React
Router app. The URL/filter utilities and the presentational components remain
framework-agnostic. The one deliberate domain exception is `useEnums` in
`hooks`: it mirrors the shared API contract's closed value sets and their app
translation key prefixes, so features cannot redeclare either. The bulk-action
lifecycle does not need that exception: `useBulkActions` takes `track` and
`describeError` as injected callbacks, so observability and HTTP-error policy
stay in `apps/web`.

## Modules

| Module       | Import                             | What it is                                                                                                                                                                                                                                            |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components` | `@workspace/shared-lib/components` | `TableShellView` (the loading/error/empty/grid/pagination states), `createSelectionColumn`, `ComboboxFilter` (with its `FilterOption` type), `DateRangeFilter`, the presentational `EmptyList` and `ErrorPanel` list states, and the shared `TableGrid` / `TablePagination` / `TableSkeleton` rendering |
| `hooks`      | `@workspace/shared-lib/hooks`      | `useTableShell` (the shared Refine table core), `createTableUrlAdapter` for flat URL ↔ Refine table state, `useEnums()` translated enum choices derived from the API contract, `useDialog` dialog state, `useBulkActions` (the shared bulk-action write lifecycle), `useClearIntent` (explicit-clear form intent) |
| `utils`      | `@workspace/shared-lib/utils`      | Small shared utilities (`debounce`, `parseFilterValues` / `joinFilterValues`, descriptor-driven `fromCrud` / `toCrud` / `deriveChips`)                                                                                                              |

## The boundary rule

`packages/shared-lib` must stay free of domain knowledge: it **must not import
from `apps/web`**. This is enforced by `no-restricted-imports` in
`packages/shared-lib/eslint.config.js`. Domain-specific code (Tasks, Users)
lives in `apps/web`; presentational primitives live in `packages/ui`.

## Layout

| Directory         | What lives there                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/` | Reusable React components (`TableShellView`, `createSelectionColumn`, `TableGrid`, `TablePagination`, `TableSkeleton`, `DateRangeFilter`, `EmptyList`, `ErrorPanel`) |
| `src/hooks/`      | Reusable React hooks (`useTableShell`, `createTableUrlAdapter`, `useEnums`, `useDialog`, `useBulkActions`, `useClearIntent`)              |
| `src/utils/`      | Framework-agnostic utilities (`debounce`, filter conversion)                                                                             |

Each directory exposes its public API through an `index.ts`, paired with a
matching entry in `package.json` `exports` (e.g.
`"./hooks": "./src/hooks/index.ts"`).
