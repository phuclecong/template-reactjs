import { useCallback } from "react"
import { Link } from "react-router-dom"

import { useIntentPrefetch } from "@/hooks/use-intent-prefetch"
import { prefetchRoute } from "@/routes/route-loaders"

type IntentLinkProps = React.ComponentProps<typeof Link>

/**
 * A router `Link` that warms its route chunk on user intent only: hover,
 * keyboard focus, or pointer down. Merely rendering it prefetches nothing, so
 * startup and idle never request chunks for unvisited routes.
 *
 * The returned prefetch callback depends only on `to`, keeping it stable for
 * memoized consumers.
 */
export function IntentLink({ ref, to, ...props }: IntentLinkProps) {
  const prefetch = useCallback(() => {
    void prefetchRoute(typeof to === "string" ? to : (to.pathname ?? ""))
  }, [to])

  const intentHandlers = useIntentPrefetch<HTMLAnchorElement>(prefetch, {
    onPointerEnter: props.onPointerEnter,
    onFocus: props.onFocus,
    onPointerDown: props.onPointerDown,
  })

  return <Link {...props} ref={ref} to={to} {...intentHandlers} />
}
