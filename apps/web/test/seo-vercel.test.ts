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

type VercelConfig = {
  headers?: HeaderRule[]
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

  it("rewrites the public routes before the catch-all", () => {
    const rewrites = readConfig().rewrites

    expect(rewrites).toEqual([
      { source: "/login", destination: "/login.html" },
      { source: "/register", destination: "/register.html" },
      { source: "/(.*)", destination: "/index.html" },
    ])
  })
})
