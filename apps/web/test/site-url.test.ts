import { describe, expect, it } from "vitest"

import { DEFAULT_SITE_URL, resolveSiteUrl } from "../vite-plugins/site-url"

describe("build-only site URL", () => {
  it("uses the local preview origin when SITE_URL is unset", () => {
    expect(DEFAULT_SITE_URL).toBe("http://localhost:4173")
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl("   ")).toBe(DEFAULT_SITE_URL)
  })

  it("normalizes a configured origin", () => {
    expect(resolveSiteUrl("https://example.com/")).toBe("https://example.com")
    expect(resolveSiteUrl("  https://example.com///  ")).toBe(
      "https://example.com"
    )
  })
})
