import { useGetIdentity } from "@refinedev/core"
import { TablePageSkeleton } from "@/components/page-skeletons"
import type { CurrentUser } from "@/features/users/utils"
import { UsersTable } from "./components/users-table"

export function UsersView() {
  const { data: identity, isLoading } = useGetIdentity<CurrentUser>()

  if (isLoading || !identity) return <TablePageSkeleton kind="users" />

  return <UsersTable currentUser={identity} />
}
