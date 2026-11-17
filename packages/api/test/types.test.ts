import { describe, expectTypeOf, it } from "vitest"
import type { components } from "../src/generated/api"

describe("generated client types", () => {
  it("matches the contract for User and Task", () => {
    type User = components["schemas"]["User"]
    type Task = components["schemas"]["Task"]

    expectTypeOf<User>().toMatchTypeOf<{
      id: string
      name: string
      email: string
      role: "admin" | "member"
      createdAt: string
    }>()

    expectTypeOf<Task>().toHaveProperty("title")
    expectTypeOf<Task>().toHaveProperty("status")
    expectTypeOf<Task>().toHaveProperty("assigneeId")
    expectTypeOf<Task["dueDate"]>().toEqualTypeOf<string | null | undefined>()
  })

  it("matches the contract for bulk task updates", () => {
    type BulkRequest = components["schemas"]["TaskBulkUpdateRequest"]
    type BulkResponse = components["schemas"]["TaskBulkUpdateResponse"]

    expectTypeOf<BulkRequest>().toHaveProperty("ids")
    expectTypeOf<BulkRequest>().toHaveProperty("status")
    expectTypeOf<BulkResponse>().toHaveProperty("updated")
    expectTypeOf<BulkResponse>().toHaveProperty("failed")
  })

  it("matches the contract for Role and RoleStatus", () => {
    type Role = components["schemas"]["Role"]
    type RoleStatus = components["schemas"]["RoleStatus"]

    expectTypeOf<Role>().toMatchTypeOf<{
      id: string
      title: string
      description: string | null
      status: "active" | "inactive"
      createdAt: string
      updatedAt: string
    }>()
    expectTypeOf<RoleStatus>().toEqualTypeOf<"active" | "inactive">()
  })

  it("matches the contract for role writes", () => {
    type Create = components["schemas"]["RoleCreateRequest"]
    type Update = components["schemas"]["RoleUpdateRequest"]
    type BulkUpdate = components["schemas"]["RoleBulkUpdateRequest"]
    type BulkUpdateResponse = components["schemas"]["RoleBulkUpdateResponse"]
    type BulkDelete = components["schemas"]["RoleBulkDeleteRequest"]
    type BulkDeleteResponse = components["schemas"]["RoleBulkDeleteResponse"]
    type Failure = components["schemas"]["RoleBulkFailure"]

    expectTypeOf<Create>().toMatchTypeOf<{
      title: string
      description?: string | null
      status?: "active" | "inactive"
    }>()
    expectTypeOf<Update>().toMatchTypeOf<{
      title?: string
      description?: string | null
      status?: "active" | "inactive"
    }>()
    expectTypeOf<BulkUpdate["ids"]>().toEqualTypeOf<string[]>()
    expectTypeOf<BulkUpdate>().toHaveProperty("description")
    expectTypeOf<BulkUpdateResponse["updated"]>().toEqualTypeOf<number>()
    expectTypeOf<BulkDelete["ids"]>().toEqualTypeOf<string[]>()
    expectTypeOf<BulkDeleteResponse["deleted"]>().toEqualTypeOf<number>()
    expectTypeOf<Failure["reason"]>().toEqualTypeOf<
      "not_found" | "system_role" | "referenced" | "validation"
    >()
  })

  it("accepts nullable string dueDate on every write request", () => {
    type CreateRequest = components["schemas"]["TaskCreateRequest"]
    type UpdateRequest = components["schemas"]["TaskUpdateRequest"]
    type BulkRequest = components["schemas"]["TaskBulkUpdateRequest"]

    expectTypeOf<CreateRequest["dueDate"]>().toEqualTypeOf<
      string | null | undefined
    >()
    expectTypeOf<UpdateRequest["dueDate"]>().toEqualTypeOf<
      string | null | undefined
    >()
    expectTypeOf<BulkRequest["dueDate"]>().toEqualTypeOf<
      string | null | undefined
    >()
  })
})
