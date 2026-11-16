// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { RouteMetadata } from "@/components/route-metadata"
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  pageTitle,
  routeMetadata,
} from "@/routes/route-metadata"
import { buildCatchAllHead, buildPublicHead } from "@/seo/head"

const ORIGIN = window.location.origin

function Navigation() {
  return (
    <nav>
      <Link to="/login">go-login</Link>
      <Link to="/register">go-register</Link>
      <Link to="/dashboard/tasks">go-tasks</Link>
      <Link to="/unknown">go-unknown</Link>
    </nav>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteMetadata />
      <Navigation />
    </MemoryRouter>
  )
}

function seo(key: string) {
  return document.head.querySelector(`[data-seo="${key}"]`)
}

function seoAll(key: string) {
  return document.head.querySelectorAll(`[data-seo="${key}"]`)
}

function content(key: string) {
  return seo(key)?.getAttribute("content")
}

function expectExactlyOne(key: string) {
  expect(seoAll(key)).toHaveLength(1)
}

/** Every `data-seo` key in a head string, as the shared builder emitted it. */
function destinationKeys(head: string) {
  const template = document.createElement("template")
  template.innerHTML = head
  return Array.from(template.content.children)
    .map((element) => element.getAttribute("data-seo"))
    .filter((key): key is string => key !== null)
}

function documentHeadKeys() {
  return Array.from(document.head.querySelectorAll("[data-seo]"))
    .map((element) => element.getAttribute("data-seo"))
    .filter((key): key is string => key !== null)
}

/** Mirrors the dev `index.html` template: a plain, unkeyed title. */
function resetHead() {
  document.head
    .querySelectorAll(
      '[data-seo], title, meta[name="description"], meta[name="robots"], ' +
        'meta[property^="og:"], meta[name^="twitter:"], ' +
        'link[rel="canonical"], script[type="application/ld+json"]'
    )
    .forEach((element) => element.remove())

  const title = document.createElement("title")
  title.textContent = "Dashboard"
  document.head.appendChild(title)
}

beforeEach(resetHead)
afterEach(resetHead)

describe("RouteMetadata", () => {
  it("writes the public head on mount and uses the browser origin", () => {
    const login = routeMetadata["/login"]
    renderAt("/login")

    expect(document.title).toBe(pageTitle(login.title))
    expect(document.head.querySelectorAll("title")).toHaveLength(1)
    expectExactlyOne("title")
    expectExactlyOne("description")
    expect(content("description")).toBe(login.description)
    expectExactlyOne("canonical")
    expect(seo("canonical")).toHaveAttribute("href", `${ORIGIN}/login`)
    expectExactlyOne("robots")
    expect(content("robots")).toBe("index, follow")
    expectExactlyOne("og:url")
    expect(seo("og:url")).toHaveAttribute("content", `${ORIGIN}/login`)
    expectExactlyOne("og:image")
    expect(seo("og:image")).toHaveAttribute(
      "content",
      `${ORIGIN}/og-image.png`
    )
    expectExactlyOne("json-ld")

    const data = JSON.parse(seo("json-ld")?.textContent ?? "{}")
    expect(data.url).toBe(`${ORIGIN}/login`)
  })

  it("updates every tag when navigating between public routes", async () => {
    const user = userEvent.setup()
    const register = routeMetadata["/register"]
    renderAt("/login")

    await user.click(screen.getByRole("link", { name: "go-register" }))

    expect(document.title).toBe(pageTitle(register.title))
    expect(content("description")).toBe(register.description)
    expect(seo("canonical")).toHaveAttribute("href", `${ORIGIN}/register`)
    expect(seo("og:url")).toHaveAttribute("content", `${ORIGIN}/register`)
    expect(content("robots")).toBe("index, follow")
    for (const key of ["title", "description", "canonical", "robots", "og:url"])
      expectExactlyOne(key)

    await user.click(screen.getByRole("link", { name: "go-login" }))

    expect(document.title).toBe(pageTitle(routeMetadata["/login"].title))
    expect(content("description")).toBe(routeMetadata["/login"].description)
    expect(seo("canonical")).toHaveAttribute("href", `${ORIGIN}/login`)
    expect(content("robots")).toBe("index, follow")
  })

  it("switches to the catch-all head for a protected route and restores the public head", async () => {
    const user = userEvent.setup()
    renderAt("/login")

    await user.click(screen.getByRole("link", { name: "go-tasks" }))

    expect(document.title).toBe(SITE_NAME)
    expect(content("description")).toBe(SITE_DESCRIPTION)
    expect(content("robots")).toBe("noindex")
    expect(seo("canonical")).toBeNull()
    expect(seo("og:url")).toBeNull()
    expect(seo("json-ld")).toBeNull()
    expect(document.head.querySelectorAll("title")).toHaveLength(1)
    expectExactlyOne("description")
    expectExactlyOne("robots")
    expect(seo("og:image")).toHaveAttribute(
      "content",
      `${ORIGIN}/og-image.png`
    )

    await user.click(screen.getByRole("link", { name: "go-login" }))

    expect(document.title).toBe(pageTitle(routeMetadata["/login"].title))
    expect(content("robots")).toBe("index, follow")
    expect(seo("canonical")).toHaveAttribute("href", `${ORIGIN}/login`)
    expect(seo("og:url")).toHaveAttribute("content", `${ORIGIN}/login`)
    expectExactlyOne("canonical")
    expectExactlyOne("og:url")
    expectExactlyOne("json-ld")
  })

  it("treats `/` and unknown paths as catch-all", async () => {
    const user = userEvent.setup()
    renderAt("/")

    expect(document.title).toBe(SITE_NAME)
    expect(content("robots")).toBe("noindex")
    expect(seo("canonical")).toBeNull()
    expect(seo("og:url")).toBeNull()
    expect(seo("json-ld")).toBeNull()

    await user.click(screen.getByRole("link", { name: "go-unknown" }))

    expect(document.title).toBe(SITE_NAME)
    expect(content("robots")).toBe("noindex")
    expect(seo("canonical")).toBeNull()
    expect(seo("og:url")).toBeNull()
    expectExactlyOne("description")
    expectExactlyOne("robots")
  })

  it("replaces a build-written head in place, correcting the origin", async () => {
    const user = userEvent.setup()
    document.head.insertAdjacentHTML(
      "beforeend",
      buildPublicHead("/login", "https://build.example")
    )

    renderAt("/login")

    expect(seo("canonical")).toHaveAttribute("href", `${ORIGIN}/login`)
    expect(document.head.innerHTML).not.toContain("build.example")
    expect(document.head.querySelectorAll("title")).toHaveLength(1)
    for (const key of ["title", "description", "canonical", "robots", "og:url"])
      expectExactlyOne(key)

    await user.click(screen.getByRole("link", { name: "go-tasks" }))

    expect(seo("canonical")).toBeNull()
    expect(seo("og:url")).toBeNull()
    expect(seo("json-ld")).toBeNull()
    expect(document.head.innerHTML).not.toContain("build.example")
  })

  it("removes duplicate keyed tags left by an earlier writer", () => {
    document.head.insertAdjacentHTML(
      "beforeend",
      '<link rel="canonical" href="https://stale.example/a" data-seo="canonical" />' +
        '<link rel="canonical" href="https://stale.example/b" data-seo="canonical" />' +
        '<meta name="description" content="stale one" data-seo="description" />' +
        '<meta name="description" content="stale two" data-seo="description" />'
    )

    renderAt("/login")

    expectExactlyOne("canonical")
    expectExactlyOne("description")
    expect(seo("canonical")).toHaveAttribute("href", `${ORIGIN}/login`)
    expect(content("description")).toBe(routeMetadata["/login"].description)
  })

  it("reconciles every key the shared builders emit", async () => {
    const user = userEvent.setup()
    renderAt("/login")

    expect(new Set(documentHeadKeys())).toEqual(
      new Set(destinationKeys(buildPublicHead("/login", ORIGIN)))
    )
    expect(documentHeadKeys()).toHaveLength(new Set(documentHeadKeys()).size)

    await user.click(screen.getByRole("link", { name: "go-tasks" }))

    expect(new Set(documentHeadKeys())).toEqual(
      new Set(destinationKeys(buildCatchAllHead(ORIGIN)))
    )
    expect(documentHeadKeys()).toHaveLength(new Set(documentHeadKeys()).size)
  })

  it("preserves a consumer-added unkeyed JSON-LD while reconciling its own tag", async () => {
    const user = userEvent.setup()
    document.head.insertAdjacentHTML(
      "beforeend",
      '<script type="application/ld+json" data-consumer="organization">' +
        '{"@context":"https://schema.org","@type":"Organization","name":"Acme"}' +
        "</script>"
    )
    const consumerTag = () =>
      document.head.querySelector('script[data-consumer="organization"]')
    const jsonLdCount = () =>
      document.head.querySelectorAll('script[type="application/ld+json"]')
        .length

    renderAt("/login")

    expect(seo("json-ld")).not.toBeNull()
    expect(consumerTag()).not.toBeNull()
    expect(jsonLdCount()).toBe(2)

    await user.click(screen.getByRole("link", { name: "go-tasks" }))

    expect(seo("json-ld")).toBeNull()
    expect(consumerTag()).not.toBeNull()
    expect(jsonLdCount()).toBe(1)

    await user.click(screen.getByRole("link", { name: "go-login" }))

    expect(seo("json-ld")).not.toBeNull()
    expect(consumerTag()).not.toBeNull()
    expect(jsonLdCount()).toBe(2)
  })
})
