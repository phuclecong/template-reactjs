export { handlers, specHandlers } from "./handlers"
export { dataHandlers } from "./data-handlers"
export {
  ensureSeedRoles,
  ensureSeedUsers,
  resetDb,
  roleSeeds,
  roles,
  seedDb,
  tasks,
  users,
} from "./collections"
export {
  getUserByAccessToken,
  loginUser,
  refreshAccessToken,
  registerUser,
  toPublicUser,
} from "./service"
export type { AuthResponseBody, PublicUser, ServiceResult } from "./service"
export type {
  RoleEntity,
  RoleRecord,
  RoleStatus,
  RoleSummary,
  TaskEntity,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  UserEntity,
  UserRecord,
} from "./collections"
export type { TokenClaims } from "./auth"
/** Generated contract types (ADR-0001); consumers must not redeclare shapes. */
export type { components, operations, paths } from "./generated/api"
