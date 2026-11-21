import { describe, expect, it } from "vitest"

import {
  ADMIN_ROLE_ID,
  MEMBER_ROLE_ID,
  SYSTEM_ROLE_IDS,
  isAdministratorRole,
  isSystemRole,
} from "../src/policy"

describe("role policy", () => {
  it("pins the two seeded System Role ids", () => {
    expect(ADMIN_ROLE_ID).toBe("rol_admin")
    expect(MEMBER_ROLE_ID).toBe("rol_member")
    expect(SYSTEM_ROLE_IDS).toEqual(["rol_admin", "rol_member"])
  })

  it("recognizes the Administrator System Role", () => {
    expect(isAdministratorRole(ADMIN_ROLE_ID)).toBe(true)
    expect(isAdministratorRole(MEMBER_ROLE_ID)).toBe(false)
    expect(isAdministratorRole("rol_demo_01")).toBe(false)
  })

  it("recognizes every System Role and nothing else", () => {
    expect(SYSTEM_ROLE_IDS.every((roleId) => isSystemRole(roleId))).toBe(true)
    expect(isSystemRole("rol_demo_01")).toBe(false)
    expect(isSystemRole("")).toBe(false)
  })
})
