// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useIntentPrefetch } from "@/hooks/use-intent-prefetch"

function Probe({ onIntent }: { onIntent: () => void }) {
  const handlers = useIntentPrefetch(onIntent)
  return <button {...handlers}>Prefetch</button>
}

describe("useIntentPrefetch", () => {
  it("does nothing when the control merely renders", () => {
    const onIntent = vi.fn()

    render(<Probe onIntent={onIntent} />)

    expect(onIntent).not.toHaveBeenCalled()
  })

  it.each(["pointerEnter", "focus", "pointerDown"] as const)(
    "calls onIntent on %s",
    (event) => {
      const onIntent = vi.fn()
      render(<Probe onIntent={onIntent} />)
      fireEvent[event](screen.getByRole("button", { name: "Prefetch" }))

      expect(onIntent).toHaveBeenCalledTimes(1)
    }
  )

  it("forwards a component's own handler as well as prefetching", () => {
    const onIntent = vi.fn()
    const onFocus = vi.fn()

    function ForwardingProbe() {
      const handlers = useIntentPrefetch(onIntent, { onFocus })
      return <button {...handlers}>Prefetch</button>
    }

    render(<ForwardingProbe />)
    fireEvent.focus(screen.getByRole("button", { name: "Prefetch" }))

    expect(onIntent).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it("keeps handlers stable for memoized consumers without pass-throughs", () => {
    const onIntent = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => {
        // A parent re-render with unrelated props must not change identity.
        void value
        return useIntentPrefetch(onIntent)
      },
      { initialProps: { value: 0 } }
    )

    const first = result.current
    rerender({ value: 1 })

    expect(result.current).toBe(first)
  })
})
