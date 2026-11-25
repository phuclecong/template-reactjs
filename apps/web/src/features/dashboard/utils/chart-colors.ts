import type { TaskPriorityBucket, TaskStatus } from "@workspace/api/schemas"

/**
 * Dashboard chart colors, drawn from the app theme tokens so the charts follow
 * the light/dark theme instead of carrying a palette of their own.
 *
 * Task status is a state, so it maps onto the theme's semantic slots: neutral
 * for not started, the theme's amber while in flight, the primary blue when
 * done, and the red accent when blocked. Every bar also carries an axis label,
 * a count label, and the chart's text table, so color never carries a value
 * alone.
 *
 * Priority escalates cool to warm across the theme's own slots - blue, amber,
 * red - so each slice reads on its own and the ramp still orders low to high.
 * Unassigned is not a level, so it stays neutral.
 */
export const STATUS_COLORS = {
  todo: "var(--muted-foreground)",
  "in-progress": "var(--chart-3)",
  done: "var(--chart-1)",
  blocked: "var(--chart-2)",
} satisfies Record<TaskStatus, string>

export const PRIORITY_COLORS = {
  low: "var(--chart-1)",
  medium: "var(--chart-3)",
  high: "var(--chart-2)",
  unassigned: "var(--muted-foreground)",
} satisfies Record<TaskPriorityBucket, string>

/**
 * Nominal identity slots for the assignee chart, taken from the theme's chart
 * tokens in their fixed order (the order is the color-vision safety mechanism).
 * Each assignee takes a slot by its stable key, so a refresh that reorders the
 * list by count never repaints the bars. Past five assignees the tail folds
 * into the neutral token rather than cycling hues; every bar keeps its name and
 * value label.
 */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export const SERIES_OVERFLOW_COLOR = "var(--muted-foreground)"
