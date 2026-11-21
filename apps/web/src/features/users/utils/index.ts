import type { UserRecord } from "@workspace/api/schemas"

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
