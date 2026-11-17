import { useGetIdentity } from "@refinedev/core"
import { TablePageSkeleton } from "@/components/page-skeletons"
import type { CurrentUser } from "@/features/users/utils"
import { RolesTable } from "./components/roles-table"

export function RolesView() {
  const { data: identity, isLoading } = useGetIdentity<CurrentUser>()

  if (isLoading || !identity) return <TablePageSkeleton kind="roles" />

  return <RolesTable />
}
