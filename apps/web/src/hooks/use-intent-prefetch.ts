import { useMemo } from "react"

type IntentEventHandlers<E extends Element> = {
  onPointerEnter?: React.PointerEventHandler<E>
  onFocus?: React.FocusEventHandler<E>
  onPointerDown?: React.PointerEventHandler<E>
}

type IntentHandlers<E extends Element> = {
  onPointerEnter: React.PointerEventHandler<E>
  onFocus: React.FocusEventHandler<E>
  onPointerDown: React.PointerEventHandler<E>
}

/**
 * Spreadable pointer-enter/focus/pointer-down handlers that call `onIntent`
 * only when the user signals intent to activate the control. Nothing is
 * requested on mount or while idle.
 *
 * The returned handlers stay referentially stable while `onIntent` (and any
 * forwarded handlers) are stable, so a memoized consumer such as
 * `TaskActionsCell` is not invalidated by prefetch wiring. Components that
 * already accept these events (for example `IntentLink`) can pass their own
 * handlers through the optional second argument.
 */
export function useIntentPrefetch<E extends Element = Element>(
  onIntent: () => void,
  passThrough?: IntentEventHandlers<E>
): IntentHandlers<E> {
  const passThroughPointerEnter = passThrough?.onPointerEnter
  const passThroughFocus = passThrough?.onFocus
  const passThroughPointerDown = passThrough?.onPointerDown

  return useMemo(
    () => ({
      onPointerEnter: (event) => {
        onIntent()
        passThroughPointerEnter?.(event)
      },
      onFocus: (event) => {
        onIntent()
        passThroughFocus?.(event)
      },
      onPointerDown: (event) => {
        onIntent()
        passThroughPointerDown?.(event)
      },
    }),
    [
      onIntent,
      passThroughPointerEnter,
      passThroughFocus,
      passThroughPointerDown,
    ]
  )
}
