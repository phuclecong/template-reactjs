import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

type HeaderRule = {
  source: string
  headers: { key: string; value: string }[]
}

type RewriteRule = {
  source: string
  destination: string
}

type RedirectRule = RewriteRule & { permanent?: boolean }

type VercelConfig = {
  headers?: HeaderRule[]
  redirects?: RedirectRule[]
  rewrites: RewriteRule[]
}

function readConfig(): VercelConfig {
  return JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
  ) as VercelConfig
}

describe("vercel.json crawl controls", () => {
  it("sets X-Robots-Tag: noindex for the dashboard prefix", () => {
    const rule = readConfig().headers?.find(
      (header) => header.source === "/dashboard/:path*"
    )

    expect(rule?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex",
    })
  })

  it("permanently redirects the root to the sign-in page", () => {
    expect(readConfig().redirects).toContainEqual({
      source: "/",
      destination: "/login",
      permanent: true,
    })
  })

  it("rewrites the public routes before the catch-all", () => {
    const rewrites = readConfig().rewrites

    expect(rewrites).toEqual([
      { source: "/login", destination: "/login.html" },
      { source: "/register", destination: "/register.html" },
      { source: "/(.*)", destination: "/index.html" },
    ])
  })
})
