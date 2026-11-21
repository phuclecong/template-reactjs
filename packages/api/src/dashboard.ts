import {
  taskPrioritySchema,
  taskStatusSchema,
  type DashboardSummary,
  type TaskPriorityBucket,
  type TaskRecord,
  type TaskStatus,
  type UserRecord,
} from "./schemas"

const TOP_ASSIGNEES = 5

/**
 * Builds the Task summary from the full Task store. Kept pure so the grouping
 * rules — what counts as open or overdue, how ties and Unassigned are ordered —
 * are testable without MSW or React.
 */
export function summarizeTasks(
  taskRecords: readonly TaskRecord[],
  users: readonly Pick<UserRecord, "id" | "name">[],
  now: Date = new Date()
): DashboardSummary {
  const statusCounts = Object.fromEntries(
    taskStatusSchema.options.map((status) => [status, 0])
  ) as Record<TaskStatus, number>
  const priorityCounts = Object.fromEntries(
    [...taskPrioritySchema.options, "unassigned"].map((priority) => [
      priority,
      0,
    ])
  ) as Record<TaskPriorityBucket, number>

  const assigneeCounts = new Map<string | null, number>()
  let done = 0
  let overdue = 0
  const nowMs = now.getTime()

  for (const task of taskRecords) {
    statusCounts[task.status] += 1
    if (task.status === "done") {
      done += 1
    } else if (task.dueDate) {
      const dueMs = Date.parse(task.dueDate)
      if (Number.isFinite(dueMs) && dueMs < nowMs) overdue += 1
    }

    const priority = task.priority ?? "unassigned"
    priorityCounts[priority] += 1

    const assigneeId = task.assigneeId ?? null
    assigneeCounts.set(assigneeId, (assigneeCounts.get(assigneeId) ?? 0) + 1)
  }

  const nameById = new Map(users.map((user) => [user.id, user.name]))
  const namedAssignees = [...assigneeCounts.entries()]
    .filter(([assigneeId]) => assigneeId !== null)
    .map(([assigneeId, count]) => ({
      assigneeId,
      name: nameById.get(assigneeId as string) ?? (assigneeId as string),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_ASSIGNEES)

  const unassignedCount = assigneeCounts.get(null) ?? 0
  if (unassignedCount > 0) {
    namedAssignees.push({
      assigneeId: null,
      name: "",
      count: unassignedCount,
    })
  }

  const total = taskRecords.length

  return {
    totals: {
      total,
      open: total - done,
      overdue,
      completionRate: total === 0 ? 0 : done / total,
    },
    byStatus: taskStatusSchema.options.map((status) => ({
      status,
      count: statusCounts[status],
    })),
    byPriority: [...taskPrioritySchema.options, "unassigned" as const].map(
      (priority) => ({
        priority,
        count: priorityCounts[priority],
      })
    ),
    byAssignee: namedAssignees,
    generatedAt: now.toISOString(),
  }
}
