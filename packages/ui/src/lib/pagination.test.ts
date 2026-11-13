import { describe, expect, it } from "vitest"

import { paginationItems } from "./pagination"

describe("paginationItems", () => {
  it("returns every page when the count fits in one window", () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(paginationItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("always includes the first and last pages for long paginations", () => {
    const items = paginationItems(5, 20)

    expect(items[0]).toBe(1)
    expect(items[items.length - 1]).toBe(20)
  })

  it("shows the current page with one neighbour on each side", () => {
    expect(paginationItems(5, 20)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      20,
    ])
  })

  it("omits the leading ellipsis near the start", () => {
    expect(paginationItems(1, 8)).toEqual([1, 2, "ellipsis", 8])
    expect(paginationItems(2, 8)).toEqual([1, 2, 3, "ellipsis", 8])
    expect(paginationItems(3, 8)).toEqual([1, 2, 3, 4, "ellipsis", 8])
  })

  it("omits the trailing ellipsis near the end", () => {
    expect(paginationItems(6, 8)).toEqual([1, "ellipsis", 5, 6, 7, 8])
    expect(paginationItems(7, 8)).toEqual([1, "ellipsis", 6, 7, 8])
    expect(paginationItems(8, 8)).toEqual([1, "ellipsis", 7, 8])
  })

  it("only ellipsises a gap, never adjacent pages", () => {
    const items = paginationItems(4, 9)

    expect(items).toEqual([1, "ellipsis", 3, 4, 5, "ellipsis", 9])
  })
})
