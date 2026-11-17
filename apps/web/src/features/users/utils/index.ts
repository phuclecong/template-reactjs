import type { CrudFilter } from "@refinedev/core"
import type { UserRecord } from "@workspace/api/schemas"

/** URL filter values for the user table. */
export type UserFilters = Record<"roleId", string>

/** The identity the user table reads from the auth provider. */
export type CurrentUser = Pick<UserRecord, "id" | "roleId">

/** A User response, including the Role summary embedded by the API. */
export type UserRow = Omit<UserRecord, "password"> & {
  role: {
    id: string
    title: string
    status: "active" | "inactive"
  }
}

/**
 * Convert the search query and URL filter values into the `CrudFilter[]` that
 * `@refinedev/core`'s `useList` understands. Empty values are skipped.
 */
export function toUserCrudFilters(
  q: string,
  filters: UserFilters
): CrudFilter[] {
  const result: CrudFilter[] = []
  if (q) result.push({ field: "q", operator: "contains", value: q })
  if (filters.roleId)
    result.push({ field: "roleId", operator: "eq", value: filters.roleId })
  return result
}
