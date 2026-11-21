import { useLayoutEffect, useRef } from "react"
import type { Table as TanStackTable } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

/** The virtualizer's height estimate before a row reports its measured size. */
const ROW_ESTIMATE = 36
/** Extra rows mounted above and below the visible range. */
const ROW_OVERSCAN = 10

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
 * A silent body row that reserves the height of unmounted rows. It carries no
 * visible cell content and is removed from the accessibility tree, so screen
 * readers hear only the logical rows and never a phantom spacer.
 */
function SpacerRow({
  height,
  columnCount,
}: {
  height: number
  columnCount: number
}) {
  return (
    <tr
      aria-hidden="true"
      role="none"
      data-slot="table-spacer-row"
      style={{ height }}
    >
      <td colSpan={columnCount} style={{ height, padding: 0, border: 0 }} />
    </tr>
  )
}

/**
 * Sortable header and row rendering for a TanStack table instance. The outer
 * wrapper is the table's single scroll container and the body is virtualized
 * inside it: only rows near the viewport are mounted, with dynamically
 * measured heights and hidden spacer rows carrying the rest of the logical
 * list. The vendored primitive's horizontal overflow is neutralized with a
 * selector variant (ADR-0009 keeps the primitive unedited), and the header
 * cells stick to the top. It owns no data or state, so every Refine `useTable`
 * consumer shares one set of header semantics (a real sort button per sortable
 * column and `aria-sort`) and one set of selected-row styles. Selection stays
 * page-scoped in TanStack's row model, so unmounted rows remain selectable.
 * See ADR-0020.
 */
export function TableGrid<T>({ table, scrollResetKey }: TableGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  // The logical size of the current page, independent of how many rows the
  // virtualizer mounts. Tests read it from the scroll element.
  const rowCount = rows.length
  const columnCount = table.getVisibleLeafColumns().length

  // The body is windowed inside the single scroll element. Measurement is
  // dynamic (each row registers through `measureElement`) so the taller Users
  // role selector is sized correctly, not just the 36px Roles/Tasks rows.
  // The virtualizer owns its own scroll and resize subscriptions; React
  // Compiler intentionally skips memoizing components that call it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: ROW_OVERSCAN,
    getItemKey: (index) => rows[index]?.id ?? index,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const firstVirtualRow = virtualRows[0]
  const lastVirtualRow = virtualRows[virtualRows.length - 1]
  // Spacer rows make the body's scroll height equal the full logical list
  // without rendering it, so the scrollbar is stable as rows mount and unmount.
  const paddingTop = firstVirtualRow?.start ?? 0
  const paddingBottom = lastVirtualRow
    ? virtualizer.getTotalSize() - lastVirtualRow.end
    : virtualizer.getTotalSize()

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
      // browser scrolls into view for keyboard focus. `contain:size` stops the
      // virtual list's content height from inflating the page frame's
      // intrinsic size: the element is sized by `h-full`, and its rows scroll
      // inside it.
      className="h-full min-h-0 scroll-pt-10 overflow-auto [contain:size] [&>[data-slot=table-container]]:overflow-visible"
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
          <SpacerRow height={paddingTop} columnCount={columnCount} />
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null
            return (
              <TableRow
                key={row.id}
                // The virtualizer reads `data-index` to record this row's
                // measured height, then positions every later row from it.
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                // One-based, offset by the header row, so assistive technology
                // and tests share the table's logical row space.
                aria-rowindex={virtualRow.index + 2}
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
            )
          })}
          <SpacerRow height={paddingBottom} columnCount={columnCount} />
        </TableBody>
      </Table>
    </div>
  )
}
