import { useLayoutEffect, useRef } from "react"
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
   * State signature from `useTableShell`. The body returns to the top when it
   * changes, so page, page size, filter, and sort changes reset the scroll
   * while selection and refetches leave it alone.
   */
  scrollResetKey: string
}

/**
 * Sortable header and row rendering for a TanStack table instance. The outer
 * wrapper is the table's single scroll container: the vendored primitive's
 * horizontal overflow is neutralized with a selector variant (ADR-0009 keeps
 * the primitive unedited), and the header cells stick to its top. It owns no
 * data or state, so every Refine `useTable` consumer shares one set of header
 * semantics (a real sort button per sortable column and `aria-sort`) and one
 * set of selected-row styles.
 */
export function TableGrid<T>({ table, scrollResetKey }: TableGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // The logical size of the current page, independent of how many rows a
  // future virtualizer mounts. Tests read it from the scroll element.
  const rowCount = table.getRowModel().rows.length

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = 0
  }, [scrollResetKey])

  return (
    <div
      ref={scrollRef}
      data-slot="table-scroll"
      data-row-count={rowCount}
      // `scroll-pt-10` keeps the sticky header from covering a row that the
      // browser scrolls into view for keyboard focus.
      className="h-full min-h-0 scroll-pt-10 overflow-auto [&>[data-slot=table-container]]:overflow-visible"
    >
      <Table aria-rowcount={rowCount + 1}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDirection = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    // Sticky belongs on each cell, not the header group, for
                    // browser support. The opaque background stops rows
                    // showing through; the inset shadow survives
                    // `border-collapse: collapse` where a border can drop.
                    className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]"
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
                          table.resetRowSelection()
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
          {table.getRowModel().rows.map((row, index) => (
            <TableRow
              key={row.id}
              data-index={index}
              // One-based, offset by the header row, so assistive technology
              // and tests share the table's logical row space.
              aria-rowindex={index + 2}
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
