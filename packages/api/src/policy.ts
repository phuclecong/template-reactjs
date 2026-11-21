/**
 * Role policy: the seeded System Role ids and the predicates over them.
 *
 * Browser-safe and dependency-free so both the API guards and the client
 * gating import the same rule (ADR-0002). This module owns no access matrix,
 * task ownership, or route gating — those stay with their callers.
 */

/** The Administrator System Role grants full access. */
export const ADMIN_ROLE_ID = "rol_admin"

/** The default Role for a self-registered User. */
export const MEMBER_ROLE_ID = "rol_member"

/** Seeded System Roles; their ids are immutable and deletion is forbidden. */
export const SYSTEM_ROLE_IDS = [ADMIN_ROLE_ID, MEMBER_ROLE_ID] as const

/** Administrator access is holding the Administrator System Role. */
export function isAdministratorRole(roleId: string): boolean {
  return roleId === ADMIN_ROLE_ID
}

/** A System Role cannot be deleted or deactivated. */
export function isSystemRole(roleId: string): boolean {
  return (SYSTEM_ROLE_IDS as readonly string[]).includes(roleId)
}
