# Refactoring code to packages/shared-lib

> The DRY ("Don't Repeat Yourself") and KISS ("Keep It Simple, Stupid") principles are core software engineering standards for writing clean, maintainable code.

Create `packages/shared-lib`, `packages/shared-lib/components`, and `packages/shared-lib/hooks`, then apply DRY and KISS principles to refactor [tasks-table](../../apps/web/src/features/tasks/components/tasks-table.tsx) so it is:

- Clean: easy to read
- Reusable: reusable when creating new tables
- Maintainable: easy to fix

## Extractions

- `FilterCombobox` (multi- and single-select) was extracted from the Tasks feature into `packages/shared-lib/src/components/filter-combobox.tsx`; it and its `FilterOption` type are exported from `@workspace/shared-lib/components`.
- `parseFilterValues` and `joinFilterValues` moved from the Tasks feature into `packages/shared-lib/src/utils/filter-values.ts` and are exported from `@workspace/shared-lib/utils`.
- Both the Tasks and Users filter bars consume the shared component and helpers; feature code keeps only its translated options, labels, and call-site wiring.
