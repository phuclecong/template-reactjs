import type { ReactNode } from "react"

export type TablePageLayoutProps = {
  children: ReactNode
}

/**
 * Children-only page frame for list screens. It owns the page height contract:
 * it is at least as tall as the shell's scroll region (`min-h-full`), and when
 * its content cannot fit it grows so the region takes over scrolling rather
 * than clipping (`shrink-0` stops the region's flex sizing from compressing it
 * back to the region height). It lays out its children in a column with the
 * existing page padding and gap; the feature keeps its own title, filters,
 * bulk bar, and overlays.
 *
 * `page-skeletons.tsx` is in the entry chunk, so it imports this module
 * through its dedicated `components/table-page-layout` subpath rather than the
 * shared components index (ADR-0017).
 */
export function TablePageLayout({ children }: TablePageLayoutProps) {
  return (
    <div
      data-slot="table-page-layout"
      className="flex min-h-full shrink-0 flex-col gap-4 p-6 text-sm"
    >
      {children}
    </div>
  )
}
