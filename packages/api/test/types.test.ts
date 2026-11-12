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
