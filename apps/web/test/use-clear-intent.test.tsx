// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useClearIntent } from "@workspace/shared-lib/hooks"

type Field = "description" | "dueDate"

type Options = {
  dirtyFields: Partial<Record<Field, boolean>>
  isDirty: boolean
}

const EMPTY: Options = { dirtyFields: {}, isDirty: false }

function renderClearIntent(initial: Options = EMPTY) {
  return renderHook((options: Options) => useClearIntent<Field>(options), {
    initialProps: initial,
  })
}

describe("useClearIntent", () => {
  it("starts with no field dirty and no changes", () => {
    const { result } = renderClearIntent()

    expect(result.current.isFieldDirty("description")).toBe(false)
    expect(result.current.isFieldDirty("dueDate")).toBe(false)
    expect(result.current.hasChanges).toBe(false)
  })

  it("follows react-hook-form's form-level dirty flag", () => {
    const { result, rerender } = renderClearIntent()

    rerender({ dirtyFields: {}, isDirty: true })
    expect(result.current.hasChanges).toBe(true)

    rerender({ dirtyFields: {}, isDirty: false })
    expect(result.current.hasChanges).toBe(false)
  })

  it("treats a react-hook-form field dirty flag as dirty", () => {
    const { result } = renderClearIntent({
      dirtyFields: { description: true },
      isDirty: true,
    })

    expect(result.current.isFieldDirty("description")).toBe(true)
    expect(result.current.isFieldDirty("dueDate")).toBe(false)
  })

  it("marks an explicitly cleared field dirty and counts it as a change", () => {
    const { result } = renderClearIntent()

    act(() => result.current.markCleared("dueDate"))

    expect(result.current.isFieldDirty("dueDate")).toBe(true)
    expect(result.current.isFieldDirty("description")).toBe(false)
    expect(result.current.hasChanges).toBe(true)
  })

  it("drops the explicit clear when the field is reset", () => {
    const { result } = renderClearIntent()

    act(() => result.current.markCleared("dueDate"))
    act(() => result.current.resetCleared("dueDate"))

    expect(result.current.isFieldDirty("dueDate")).toBe(false)
    expect(result.current.hasChanges).toBe(false)
  })

  it("keeps multiple fields independent", () => {
    const { result } = renderClearIntent()

    act(() => result.current.markCleared("description"))
    act(() => result.current.markCleared("dueDate"))
    act(() => result.current.resetCleared("description"))

    expect(result.current.isFieldDirty("description")).toBe(false)
    expect(result.current.isFieldDirty("dueDate")).toBe(true)
    expect(result.current.hasChanges).toBe(true)
  })
})
