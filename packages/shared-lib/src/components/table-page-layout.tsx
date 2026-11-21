import type { ReactNode } from "react"

export type TablePageLayoutProps = {
  children: ReactNode
}

/**
 * Children-only page frame for list screens. It owns the page height contract:
 * at least as tall as the shell's scroll region and free to grow when the
 * content cannot fit, laid out as a column with the existing page padding and
 * gap. The feature keeps its own title, filters, bulk bar, and overlays.
 *
 * `page-skeletons.tsx` is in the entry chunk, so it imports this module
 * through its dedicated `components/table-page-layout` subpath rather than the
 * shared components index (ADR-0017).
 */
export function TablePageLayout({ children }: TablePageLayoutProps) {
  return (
    <div
      data-slot="table-page-layout"
      className="flex min-h-full flex-col gap-4 p-6 text-sm"
    >
      {children}
    </div>
  )
}
