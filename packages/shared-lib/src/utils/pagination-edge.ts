/**
 * Props shared by the previous/next pagination controls. At an edge the
 * control is marked disabled and removed from the tab order; otherwise it
 * gets the handler that moves one page.
 */
export type PaginationEdgeProps = {
  "aria-disabled"?: true
  tabIndex?: number
  onClick?: () => void
}

/** Build the edge-dependent props for a previous/next pagination control. */
export function paginationEdgeProps(
  isEdge: boolean,
  onGo: () => void
): PaginationEdgeProps {
  return isEdge
    ? { "aria-disabled": true, tabIndex: -1 }
    : { onClick: onGo }
}
