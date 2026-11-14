import { Skeleton } from "@workspace/ui/components/skeleton"

type TableSkeletonProps = {
  /** Column widths in pixels, matching the real table's header sizes. */
  columnWidths: number[]
  /** Number of placeholder rows. Match the active page size. */
  rowCount: number
  /** Translated loading announcement for assistive technology. */
  label: string
}

/**
 * Layout-reserving table placeholder. It deliberately renders no `<table>`,
 * `columnheader`, or pagination semantics: those would satisfy e2e waits and
 * expose a false sort/pagination state while the real table is still loading.
 * The status region is visually hidden so the skeleton itself is the visual
 * signal and rows do not jump when the label disappears.
 */
export function TableSkeleton({
  columnWidths,
  rowCount,
  label,
}: TableSkeletonProps) {
  return (
    <>
      <div role="status" className="sr-only">
        {label}
      </div>
      <div
        className="overflow-x-auto border border-border"
        aria-hidden="true"
        data-slot="table-skeleton"
      >
        <div style={{ minWidth: "max-content" }}>
          <div className="flex h-10 items-center border-b border-border px-2">
            {columnWidths.map((width, index) => (
              <div
                key={`head-${index}`}
                data-slot="table-skeleton-cell"
                className="px-2"
                style={{ width }}
              >
                <Skeleton style={{ height: 16, width: "75%" }} />
              </div>
            ))}
          </div>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <div
              key={rowIndex}
              data-slot="table-skeleton-row"
              className="flex h-9 items-center border-b border-border px-2"
            >
              {columnWidths.map((width, index) => (
                <div
                  key={`cell-${index}`}
                  data-slot="table-skeleton-cell"
                  className="px-2"
                  style={{ width }}
                >
                  <Skeleton
                    className={index === 0 ? "h-4 w-4" : undefined}
                    style={
                      index === 0 ? undefined : { height: 16, width: "66%" }
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-4"
        aria-hidden="true"
        data-slot="table-skeleton-footer"
      >
        <div className="flex items-center gap-2">
          <Skeleton style={{ height: 16, width: 96 }} />
          <Skeleton style={{ height: 28, width: 64 }} />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
    </>
  )
}
