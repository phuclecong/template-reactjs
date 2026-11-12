import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
const COARSE_POINTER_QUERY = "(pointer: coarse)"

/**
 * True when the viewport is narrow or the primary pointer is coarse. Width
 * alone misses wide touch devices (tablets, touch laptops), which need the
 * sheet layout just as much as phones do.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // jsdom (and very old browsers) do not implement matchMedia. Fall back to
    // the viewport width so the hook still resolves instead of throwing.
    if (typeof window.matchMedia !== "function") {
      const onChange = () => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      }
      onChange()
      return
    }

    const widthQuery = window.matchMedia(MOBILE_QUERY)
    const pointerQuery = window.matchMedia(COARSE_POINTER_QUERY)
    const onChange = () => {
      setIsMobile(widthQuery.matches || pointerQuery.matches)
    }

    widthQuery.addEventListener("change", onChange)
    pointerQuery.addEventListener("change", onChange)
    onChange()
    return () => {
      widthQuery.removeEventListener("change", onChange)
      pointerQuery.removeEventListener("change", onChange)
    }
  }, [])

  return !!isMobile
}
