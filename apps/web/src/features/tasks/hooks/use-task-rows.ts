import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useList } from "@refinedev/core"
import type { TaskRecord } from "@workspace/api/schemas"

import type { UserOption } from "@/features/tasks/utils"
import type { CurrentUser } from "@/features/users/utils"

/**
 * The user lookup the Tasks table needs: options for the assignee controls and
 * a resolver for the assignee column. Task rows themselves come from Refine's
 * `useTable`, so this hook never requests tasks.
 */
export function useTaskRows() {
  const { t } = useTranslation()

  const usersQuery = useList<UserOption>({
    resource: "users",
    pagination: { pageSize: 100 },
  })
  const users = useMemo(
    () => usersQuery.result.data ?? [],
    [usersQuery.result.data]
  )

  const assigneeNameById = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users]
  )

  const assigneeName = useCallback(
    (assigneeId: string | null | undefined) =>
      assigneeId
        ? (assigneeNameById.get(assigneeId) ?? t("tasks.unknown"))
        : t("tasks.unassigned"),
    [assigneeNameById, t]
  )

  return { users, assigneeName }
}

/** Administrators may modify any Task; members only the tasks assigned to them. */
export function canModifyTask(
  task: TaskRecord,
  currentUser: CurrentUser
): boolean {
  return (
    currentUser.roleId === "rol_admin" || task.assigneeId === currentUser.id
  )
}
