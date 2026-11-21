import { describe, expect, it } from "vitest"

import {
  routeAssets,
  routeSourceKey,
  staticClosure,
  summarizeBuild,
  summarizeRoute,
} from "../scripts/perf/build-budget.mjs"

const manifest = {
  "index.html": {
    file: "assets/index.js",
    imports: ["_runtime.js", "_vendor.js"],
    dynamicImports: [
      "src/routes/login.tsx",
      "src/routes/tasks.tsx",
      "src/utils/msw.ts",
    ],
    css: ["assets/index.css"],
  },
  "_runtime.js": { file: "assets/runtime.js", imports: [] },
  "_vendor.js": { file: "assets/vendor.js", imports: ["_runtime.js"] },
  "src/routes/login.tsx": {
    file: "assets/login.js",
    imports: ["index.html", "_vendor.js"],
  },
  "src/routes/tasks.tsx": {
    file: "assets/tasks.js",
    imports: ["index.html", "src/features/dialog.tsx"],
    dynamicImports: ["src/features/sheet.tsx"],
  },
  "src/features/dialog.tsx": { file: "assets/dialog.js", imports: [] },
  "src/features/sheet.tsx": { file: "assets/sheet.js", imports: [] },
  "src/utils/msw.ts": { file: "assets/msw.js", imports: [] },
}

const fileBytes = {
  "assets/index.js": 100,
  "assets/runtime.js": 10,
  "assets/vendor.js": 50,
  "assets/index.css": 30,
  "assets/login.js": 40,
  "assets/tasks.js": 80,
  "assets/dialog.js": 20,
  "assets/sheet.js": 999,
  "assets/msw.js": 999,
}

const sizeOf = (file: string) => fileBytes[file]

describe("routeSourceKey", () => {
  it("maps a route path to its Vite manifest key", () => {
    expect(routeSourceKey("/tasks")).toBe("src/routes/tasks.tsx")
    expect(routeSourceKey("/settings")).toBe("src/routes/settings.tsx")
  })
})

describe("staticClosure", () => {
  it("follows static imports and tolerates cycles", () => {
    const closure = staticClosure(manifest, ["index.html"])

    expect([...closure].sort()).toEqual(
      ["_runtime.js", "_vendor.js", "index.html"].sort()
    )
  })

  it("does not follow dynamic imports", () => {
    const closure = staticClosure(manifest, [
      "index.html",
      "src/routes/tasks.tsx",
    ])

    expect(closure.has("src/features/dialog.tsx")).toBe(true)
    expect(closure.has("src/features/sheet.tsx")).toBe(false)
    expect(closure.has("src/utils/msw.ts")).toBe(false)
    expect(closure.has("src/router/login.tsx")).toBe(false)
  })
})

describe("routeAssets", () => {
  it("returns the sorted, deduplicated scripts and stylesheets in a route closure", () => {
    expect(routeAssets(manifest, "/tasks")).toEqual({
      scripts: [
        "assets/dialog.js",
        "assets/index.js",
        "assets/runtime.js",
        "assets/tasks.js",
        "assets/vendor.js",
      ],
      stylesheets: ["assets/index.css"],
    })
  })

  it("throws when the route is not a lazy manifest entry", () => {
    expect(() => routeAssets(manifest, "/missing")).toThrow(
      /Manifest has no entry "src\/routes\/missing.tsx"/
    )
  })
})

describe("summarizeRoute", () => {
  it("sums JS and CSS bytes separately and counts shared chunks once", () => {
    expect(summarizeRoute(manifest, "/login", sizeOf)).toEqual({
      route: "/login",
      jsBytes: 200,
      cssBytes: 30,
    })
  })

  it("excludes chunks reached only through dynamic imports", () => {
    expect(summarizeRoute(manifest, "/tasks", sizeOf)).toEqual({
      route: "/tasks",
      jsBytes: 260,
      cssBytes: 30,
    })
  })
})

describe("summarizeBuild", () => {
  it("returns one summary per route in the order given", () => {
    expect(
      summarizeBuild({
        manifest,
        routes: ["/login", "/tasks"],
        fileBytes: sizeOf,
      }).map((summary: { route: string }) => summary.route)
    ).toEqual(["/login", "/tasks"])
  })
})
