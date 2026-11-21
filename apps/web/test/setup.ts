import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom does not implement matchMedia. The responsive DatePicker subscribes to
// it through `useIsMobile`; a no-match stub keeps the desktop popover layout.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  })
}

// jsdom performs no layout: the table body scroll element reports zero height
// and every row reports zero height, so the real `@tanstack/react-virtual`
// would mount nothing. Give only the fitted-table elements a synthetic
// geometry — a viewport-sized scroll element and a fixed row height — and let
// every other element keep jsdom's zero-size defaults. The virtualizer is not
// mocked; it still reads these measurements and runs its own range logic.
if (typeof window !== "undefined" && typeof Element !== "undefined") {
  const TABLE_SCROLL = '[data-slot="table-scroll"]'
  const TABLE_ROW = 'tbody tr[data-slot="table-row"]'
  const VIEWPORT_HEIGHT = 600
  const ROW_HEIGHT = 36

  const isTableScroll = (element: Element) => element.matches(TABLE_SCROLL)
  const isTableRow = (element: Element) => element.matches(TABLE_ROW)
  const heightFor = (element: Element): number | null => {
    if (isTableScroll(element)) return VIEWPORT_HEIGHT
    if (isTableRow(element)) return ROW_HEIGHT
    return null
  }

  const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "clientHeight"
  )
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    enumerable: true,
    get(this: Element) {
      const height = heightFor(this)
      if (height !== null) return height
      return clientHeightDescriptor?.get?.call(this) ?? 0
    },
  })

  const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight"
  )
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    enumerable: true,
    get(this: HTMLElement) {
      const height = heightFor(this)
      if (height !== null) return height
      return offsetHeightDescriptor?.get?.call(this) ?? 0
    },
  })

  // `measureElement` and the scroll rect use `offsetHeight`/`clientHeight`,
  // but rect reads are common enough that tests and tooling may ask for them.
  const originalRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const height = heightFor(this)
    if (height === null) return originalRect.call(this)
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: height,
      width: 0,
      height,
      toJSON: () => ({}),
    } as DOMRect
  }

  // The virtualizer registers both its scroll element and each mounted row
  // with a ResizeObserver. This stand-in delivers one synthetic entry per
  // observation (using the same synthetic sizes) and otherwise does nothing.
  if (!("ResizeObserver" in window)) {
    class MeasurementResizeObserver {
      private readonly entries = new Set<Element>()
      private disconnected = false

      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element) {
        this.entries.add(target)
        queueMicrotask(() => {
          if (this.disconnected) return
          const height = heightFor(target) ?? 0
          this.callback(
            [
              {
                target,
                borderBoxSize: [{ blockSize: height, inlineSize: 0 }],
                contentBoxSize: [{ blockSize: height, inlineSize: 0 }],
                contentRect: {
                  x: 0,
                  y: 0,
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: height,
                  width: 0,
                  height,
                },
              } as unknown as ResizeObserverEntry,
            ],
            this as unknown as ResizeObserver
          )
        })
      }

      unobserve(target: Element) {
        this.entries.delete(target)
      }

      disconnect() {
        this.disconnected = true
        this.entries.clear()
      }
    }

    window.ResizeObserver =
      MeasurementResizeObserver as unknown as typeof ResizeObserver
  }
}

afterEach(() => {
  if (typeof window !== "undefined") cleanup()
})
