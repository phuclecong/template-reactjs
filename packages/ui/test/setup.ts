import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom does not implement matchMedia. The responsive pickers subscribe to it
// through `useIsMobile`; this stub answers the viewport-width query from
// `window.innerWidth` (tests can override it for the narrow layout) and treats
// a coarse pointer as opt-in via `window.__coarsePointer`.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => {
      const widthMatch = /\(max-width:\s*(\d+)px\)/.exec(query)
      const matches =
        query === "(pointer: coarse)"
          ? Boolean((window as unknown as { __coarsePointer?: boolean }).__coarsePointer)
          : widthMatch
            ? window.innerWidth <= Number(widthMatch[1])
            : false

      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList
    },
  })
}

afterEach(() => {
  cleanup()
})
