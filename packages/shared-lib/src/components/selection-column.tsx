import type { BaseRecord } from "@refinedev/core"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { Checkbox } from "@workspace/ui/components/checkbox"

export type SelectionColumnOptions<TData> = {
  /** Column width in pixels, supplied per feature like every other width. */
  width: number
  /** Translated accessible label for the select-all checkbox. */
  selectAllLabel: string
  /** Translated accessible label for a row's checkbox. */
  selectRowLabel: (row: TData) => string
  /**
   * Optional additional gate. TanStack's `enableRowSelection` predicate
   * already reaches `row.getCanSelect()`; this lets a feature combine that
   * with a non-table rule without building its own checkbox cells.
   */
  getCanSelect?: (row: TData) => boolean
}

function canSelectRow<TData>(
  row: Row<TData>,
  getCanSelect?: (row: TData) => boolean
): boolean {
  return row.getCanSelect() && (getCanSelect?.(row.original) ?? true)
}

/**
 * The page-scoped selection column shared by Roles and Tasks. It renders the
 * select-all header and per-row checkbox, disables rows the table or feature
 * says cannot be selected, and leaves labels to the caller so the shell stays
 * free of translation keys. Pair it with `useTableShell`'s `enableRowSelection`;
 * TanStack owns the selection state.
 */
export function createSelectionColumn<TData extends BaseRecord>({
  width,
  selectAllLabel,
  selectRowLabel,
  getCanSelect,
}: SelectionColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: "select",
    size: width,
    enableSorting: false,
    header: ({ table }) => {
      const selectable = table
        .getRowModel()
        .rows.some((row) => canSelectRow(row, getCanSelect))
      return (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          disabled={!selectable}
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(!!checked)
          }
          aria-label={selectAllLabel}
        />
      )
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!canSelectRow(row, getCanSelect)}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
        aria-label={selectRowLabel(row.original)}
      />
    ),
  }
}
