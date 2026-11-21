import { useSyncExternalStore } from "react"

/**
 * Reads the user's motion preference. No Refine hook covers a media query, so
 * this is a local subscription to `matchMedia`; charts use it to disable
 * Recharts' entry animations.
 */
const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
