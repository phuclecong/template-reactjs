import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import {
  buildCatchAllHead,
  buildPublicHead,
  publicRoutePath,
} from "../../vite-plugins/seo-head"

/**
 * Tags the SEO head may leave unkeyed. The dev `index.html` template carries a
 * plain `<title>` and a host or template may add defaults; they would compete
 * with the keyed tags the component writes (`document.title` reads the first
 * title element), so they are removed before reconciling.
 */
const UNKEYED_HEAD_SELECTORS = [
  "title",
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'link[rel="canonical"]',
  'script[type="application/ld+json"]',
]

function removeUnkeyedHeadTags(head: HTMLElement) {
  for (const selector of UNKEYED_HEAD_SELECTORS) {
    for (const element of Array.from(
      head.querySelectorAll(`${selector}:not([data-seo])`)
    )) {
      element.remove()
    }
  }
}

function parseHead(head: string): Element[] {
  const template = document.createElement("template")
  template.innerHTML = head
  return Array.from(template.content.children)
}

function syncAttributes(current: Element, target: Element) {
  for (const attribute of Array.from(current.attributes)) {
    if (!target.hasAttribute(attribute.name)) {
      current.removeAttribute(attribute.name)
    }
  }
  for (const attribute of Array.from(target.attributes)) {
    if (current.getAttribute(attribute.name) !== attribute.value) {
      current.setAttribute(attribute.name, attribute.value)
    }
  }
}

function applyTag(current: Element, target: Element) {
  if (current.tagName !== target.tagName) {
    current.replaceWith(document.importNode(target, true))
    return
  }
  syncAttributes(current, target)
  if (current.textContent !== target.textContent) {
    current.textContent = target.textContent
  }
}

/**
 * Reconciles the document head with a set of `data-seo`-keyed tags: existing
 * tags are updated in place, missing ones are created, and any keyed tag that
 * is not in the destination — plus any leftover unkeyed duplicate — is removed.
 * The same key can therefore never appear twice.
 */
function reconcileHead(head: string) {
  const documentHead = document.head
  removeUnkeyedHeadTags(documentHead)

  const destination = new Map<string, Element>()
  for (const element of parseHead(head)) {
    const key = element.getAttribute("data-seo")
    if (key) destination.set(key, element)
  }

  const seen = new Set<string>()
  for (const existing of Array.from(
    documentHead.querySelectorAll("[data-seo]")
  )) {
    const key = existing.getAttribute("data-seo")
    const target = key ? destination.get(key) : undefined
    if (!key || !target || seen.has(key)) {
      existing.remove()
      continue
    }
    seen.add(key)
    applyTag(existing, target)
  }

  for (const [key, target] of destination) {
    if (seen.has(key)) continue
    documentHead.appendChild(document.importNode(target, true))
  }
}

/**
 * Keeps the document head in sync with client-side navigation. Page metadata
 * is declared once in `routeMetadata`; the build emits it for crawlable HTML
 * and this component rewrites the same `data-seo`-keyed tags in the browser.
 *
 * Canonical, `og:url`, and the social image use `window.location.origin`
 * rather than `SITE_URL`, so preview deployments and localhost describe
 * themselves correctly. Protected routes, `/`, and unknown paths get the
 * catch-all head: `noindex`, no canonical, no `og:url`, and no JSON-LD.
 *
 * React 19's native document-metadata hoisting is deliberately not used: it
 * cannot see the tags the build wrote and would leave a second stale tag.
 */
export function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const publicPath = publicRoutePath(pathname)
    reconcileHead(
      publicPath
        ? buildPublicHead(publicPath, window.location.origin)
        : buildCatchAllHead(window.location.origin)
    )
  }, [pathname])

  return null
}
