/**
 * Canonical pixel widths for the Users table columns, keyed in render order.
 *
 * The real table (`components/users-table.tsx`) reads each column's `size`
 * from this record, and the page skeleton (`@/components/page-skeletons`)
 * reserves the same widths. The actions column is rendered only for admins,
 * but the skeleton reserves it so the admin table does not shift on load.
 */
export const USER_COLUMN_WIDTHS = {
  name: 220,
  email: 300,
  role: 160,
  actions: 100,
} as const

/** Widths in table order, for the table loading skeleton. */
export const USER_SKELETON_COLUMN_WIDTHS: number[] = Object.values(
  USER_COLUMN_WIDTHS
)
