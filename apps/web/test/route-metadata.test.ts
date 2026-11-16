import { describe, expect, it } from "vitest"

import { routeLoaders } from "../src/routes/route-loaders"
import {
  OG_IMAGE_PATH,
  SITE_NAME,
  absoluteUrl,
  canonicalUrl,
  pageTitle,
  routeMetadata,
} from "../src/routes/route-metadata"

describe("route metadata table", () => {
  it("covers every route exactly once", () => {
    expect(Object.keys(routeMetadata).sort()).toEqual(
      Object.keys(routeLoaders).sort()
    )
  })

  it("marks the public routes indexable and the protected routes not", () => {
    expect(routeMetadata["/login"].indexable).toBe(true)
    expect(routeMetadata["/register"].indexable).toBe(true)
    expect(routeMetadata["/dashboard/tasks"].indexable).toBe(false)
    expect(routeMetadata["/dashboard/users"].indexable).toBe(false)
    expect(routeMetadata["/dashboard/settings"].indexable).toBe(false)
  })

  it("gives every route a non-empty title and description", () => {
    for (const metadata of Object.values(routeMetadata)) {
      expect(metadata.title.trim()).not.toBe("")
      expect(metadata.description.trim()).not.toBe("")
    }
  })
})

describe("site defaults", () => {
  it("uses Dashboard as the site name", () => {
    expect(SITE_NAME).toBe("Dashboard")
  })

  it("applies the title template", () => {
    expect(pageTitle("Sign in")).toBe("Sign in | Dashboard")
    expect(pageTitle("Create an account")).toBe("Create an account | Dashboard")
  })

  it("builds absolute canonical URLs from a concrete origin", () => {
    expect(canonicalUrl("/login", "https://example.com")).toBe(
      "https://example.com/login"
    )
    expect(canonicalUrl("/register", "https://example.com")).toBe(
      "https://example.com/register"
    )
  })

  it("builds absolute asset URLs on the same origin", () => {
    expect(absoluteUrl(OG_IMAGE_PATH, "https://example.com")).toBe(
      "https://example.com/og-image.png"
    )
  })
})
