/**
 * Canonical pixel widths for the Roles table columns, keyed in render order.
 *
 * The real table (`components/roles-table.tsx`) reads each column's `size`
 * from this record, and the page skeleton (`@/components/page-skeletons`)
 * reserves the same widths so the loading layout does not shift.
 */
export const ROLE_COLUMN_WIDTHS = {
  title: 220,
  description: 360,
  status: 120,
  createdAt: 180,
  updatedAt: 180,
} as const

/** Width of the administrator-only selection checkbox column. */
export const ROLE_SELECT_COLUMN_WIDTH = 40

/** Widths in table order, for the table loading skeleton. */
export const ROLE_SKELETON_COLUMN_WIDTHS: number[] =
  Object.values(ROLE_COLUMN_WIDTHS)
