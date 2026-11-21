import type { BaseRecord } from "@refinedev/core"
import type { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@workspace/ui/components/checkbox"

export type SelectionColumnOptions<TData> = {
  /** Column width in pixels, supplied per feature like every other width. */
  width: number
  /** Translated accessible label for the select-all checkbox. */
  selectAllLabel: string
  /** Translated accessible label for a row's checkbox. */
  selectRowLabel: (row: TData) => string
}

/**
 * The page-scoped selection column shared by Roles and Tasks. It renders the
 * select-all header and per-row checkbox, disables rows the table says cannot
 * be selected, and leaves labels to the caller so the shell stays free of
 * translation keys. Pair it with `useTableShell`'s `enableRowSelection`;
 * TanStack owns the selection state and `row.getCanSelect()` owns the gate.
 */
export function createSelectionColumn<TData extends BaseRecord>({
  width,
  selectAllLabel,
  selectRowLabel,
}: SelectionColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: "select",
    size: width,
    enableSorting: false,
    header: ({ table }) => {
      const selectable = table
        .getRowModel()
        .rows.some((row) => row.getCanSelect())
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
        disabled={!row.getCanSelect()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
        aria-label={selectRowLabel(row.original)}
      />
    ),
  }
}
