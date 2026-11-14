import { describe, expect, it } from "vitest"
import { joinFilterValues, parseFilterValues } from "../src/utils"

describe("parseFilterValues", () => {
  it("splits a comma-joined value into trimmed values", () => {
    expect(parseFilterValues("todo, in-progress,done")).toEqual([
      "todo",
      "in-progress",
      "done",
    ])
  })

  it("drops empty segments", () => {
    expect(parseFilterValues("todo,,  ,in-progress,")).toEqual([
      "todo",
      "in-progress",
    ])
  })

  it("returns an empty list for an empty value", () => {
    expect(parseFilterValues("")).toEqual([])
    expect(parseFilterValues("  ,  ")).toEqual([])
  })
})

describe("joinFilterValues", () => {
  it("joins selected values with commas", () => {
    expect(joinFilterValues(["todo", "in-progress"])).toBe("todo,in-progress")
  })

  it("joins an empty selection to an empty string", () => {
    expect(joinFilterValues([])).toBe("")
  })
})
