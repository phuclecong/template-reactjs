import type { UserRecord } from "@workspace/api/schemas"

/** The slice of a User the task views need: an id and a display name. */
export type UserOption = Pick<UserRecord, "id" | "name">
