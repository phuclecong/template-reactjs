/**
 * Canonical pixel widths for the Tasks table columns, keyed in render order.
 *
 * The real table (`components/tasks-table.tsx`) reads each column's `size`
 * from this record, and the page skeleton (`@/components/page-skeletons`)
 * reserves the same widths. Keeping one source prevents the loading layout
 * from drifting away from the rendered table (and shifting CLS).
 */
export const TASK_COLUMN_WIDTHS = {
  select: 36,
  title: 360,
  status: 120,
  priority: 120,
  assignee: 180,
  dueDate: 200,
  actions: 140,
} as const

/** Widths in table order, for the table loading skeleton. */
export const TASK_SKELETON_COLUMN_WIDTHS: number[] = Object.values(
  TASK_COLUMN_WIDTHS
)
