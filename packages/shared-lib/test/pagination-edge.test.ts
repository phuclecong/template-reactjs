import { describe, expect, it, vi } from "vitest"
import { paginationEdgeProps } from "../src/utils"

describe("paginationEdgeProps", () => {
  it("disables the edge control and removes it from the tab order", () => {
    const onGo = vi.fn()
    const props = paginationEdgeProps(true, onGo)

    expect(props["aria-disabled"]).toBe(true)
    expect(props.tabIndex).toBe(-1)
    expect(props.onClick).toBeUndefined()
    expect(onGo).not.toHaveBeenCalled()
  })

  it("makes the control operable away from the edge", () => {
    const onGo = vi.fn()
    const props = paginationEdgeProps(false, onGo)

    expect(props["aria-disabled"]).toBeUndefined()
    expect(props.tabIndex).toBeUndefined()
    expect(props.onClick).toBeTypeOf("function")

    props.onClick?.()

    expect(onGo).toHaveBeenCalledTimes(1)
  })
})
