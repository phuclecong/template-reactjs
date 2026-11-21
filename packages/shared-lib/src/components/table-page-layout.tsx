import type { ReactNode } from "react"

export type TablePageLayoutProps = {
  children: ReactNode
}

/**
 * Children-only page frame for list screens. It owns the page height contract:
 * it fills the shell's scroll region below the fixed header, and when the
 * content cannot fit its content overflows into the region's fallback scroll
 * rather than being clipped. It lays out its children in a column with the
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
      className="flex min-h-0 flex-1 flex-col gap-4 p-6 text-sm"
    >
      {children}
    </div>
  )
}
