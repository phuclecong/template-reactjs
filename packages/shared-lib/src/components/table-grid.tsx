import type { Table as TanStackTable } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export type TableGridProps<T> = {
  /** TanStack table instance, from `useReactTable` or Refine's `useTable`. */
  table: TanStackTable<T>
  /**
   * Called before a sortable header toggles. Use it to reset state keyed to the
   * current row order, such as the Roles table's selection.
   */
  onSort?: () => void
}

/**
 * Sortable header and row rendering for a TanStack table instance. It owns no
 * data or state, so both `DataTable` and Refine's `useTable` consumers share
 * one set of header semantics (a real sort button per sortable column and
 * `aria-sort`) and one set of selected-row styles.
 */
export function TableGrid<T>({ table, onSort }: TableGridProps<T>) {
  return (
    <div className="overflow-x-auto border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDirection = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    aria-sort={
                      sortDirection === "asc"
                        ? "ascending"
                        : sortDirection === "desc"
                          ? "descending"
                          : header.column.getCanSort()
                            ? "none"
                            : undefined
                    }
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          onSort?.()
                          header.column.getToggleSortingHandler()?.(event)
                        }}
                        className="inline-flex items-center gap-1 text-left"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sortDirection === "asc" ? (
                          <ArrowUpIcon className="size-3" aria-hidden="true" />
                        ) : sortDirection === "desc" ? (
                          <ArrowDownIcon
                            className="size-3"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowUpDownIcon
                            className="size-3 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
