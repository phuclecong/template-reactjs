import { describe, expect, it } from "vitest"

import {
  findMswManifestEntries,
  findMswMarkersInSource,
  findMswReferencesInHtml,
} from "../scripts/perf/verify-real-build.mjs"

describe("real-backend build assertion", () => {
  const mockManifest = {
    "index.html": {
      file: "assets/index-abc.js",
      isEntry: true,
      dynamicImports: ["src/utils/msw.ts"],
    },
    "src/utils/msw.ts": {
      file: "assets/msw-def.js",
      name: "msw",
      src: "src/utils/msw.ts",
      isDynamicEntry: true,
    },
  }

  const realManifest = {
    "index.html": {
      file: "assets/index-xyz.js",
      isEntry: true,
      dynamicImports: ["src/routes/tasks.tsx"],
    },
    "src/routes/tasks.tsx": {
      file: "assets/tasks-123.js",
      name: "tasks",
      src: "src/routes/tasks.tsx",
      isDynamicEntry: true,
    },
  }

  it("finds the mock worker chunks in the audited mock build", () => {
    expect(findMswManifestEntries(mockManifest)).toEqual(["src/utils/msw.ts"])
  })

  it("finds no mock worker chunk in a real-backend manifest", () => {
    expect(findMswManifestEntries(realManifest)).toEqual([])
  })

  it("detects MSW runtime code in emitted assets", () => {
    expect(
      findMswMarkersInSource("const worker = setupWorker(...handlers)")
    ).toEqual(["setupWorker"])
    expect(
      findMswMarkersInSource("await navigator.serviceWorker.ready")
    ).toEqual([])
  })

  it("detects a preload reference to a mock worker chunk", () => {
    const html =
      '<link rel="modulepreload" href="/assets/msw-def.js">' +
      '<script type="module" src="/assets/index-abc.js"></script>'

    expect(findMswReferencesInHtml(html)).toEqual(["msw-def.js"])
    expect(
      findMswReferencesInHtml('<script src="/assets/index-abc.js"></script>')
    ).toEqual([])
  })
})
