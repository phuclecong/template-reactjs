import { useGetIdentity } from "@refinedev/core"
import { TablePageSkeleton } from "@/components/page-skeletons"
import { TasksTable } from "./components/tasks-table"
import type { CurrentUser } from "@/features/users/utils"

export function TasksView() {
  const { data: identity, isLoading } = useGetIdentity<CurrentUser>()

  if (isLoading || !identity) return <TablePageSkeleton kind="tasks" />

  return <TasksTable currentUser={identity} />
}
