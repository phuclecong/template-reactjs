import { describe, expect, it } from "vitest"

import {
  assertChunkBoundaries,
  assertInitialClosure,
  assertVendorFamilies,
  findEntryChunk,
  findReferencedScripts,
  findMswManifestEntries,
  findMswMarkersInSource,
  findMswReferencesInHtml,
  findOversizedChunks,
  findVendorModules,
} from "../scripts/perf/verify-real-build.mjs"
import {
  FORBIDDEN_IN_INITIAL,
  VENDOR_GROUPS,
  packageNameOf,
} from "../scripts/perf/vendor-groups.mjs"

describe("vendor group matching", () => {
  it("extracts the package name from pnpm-resolved ids", () => {
    expect(
      packageNameOf(
        "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js"
      )
    ).toBe("react")
    expect(
      packageNameOf(
        "/repo/node_modules/.pnpm/@refinedev+core@5.0.12/node_modules/@refinedev/core/dist/index.js"
      )
    ).toBe("@refinedev/core")
    expect(
      packageNameOf(
        "C:\\repo\\node_modules\\.pnpm\\react-dom@19.2.6\\node_modules\\react-dom\\index.js"
      )
    ).toBe("react-dom")
  })

  it("returns null for first-party and virtual modules", () => {
    expect(packageNameOf("/repo/apps/web/src/App.tsx")).toBeNull()
    expect(packageNameOf("\0commonjsHelpers.js")).toBeNull()
  })

  it("matches a family by package name, not by prefix", () => {
    const reactGroup = VENDOR_GROUPS.find(
      (group: { name: string }) => group.name === "vendor-react"
    )!

    expect(
      reactGroup.test(
        "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js"
      )
    ).toBe(true)
    expect(
      reactGroup.test(
        "/repo/node_modules/.pnpm/react-hook-form@7.91.0/node_modules/react-hook-form/dist/index.js"
      )
    ).toBe(false)
  })

  it("captures every family only from the initial closure", () => {
    for (const group of VENDOR_GROUPS) {
      expect(group.tags).toEqual(["$initial"])
    }
    expect(FORBIDDEN_IN_INITIAL).toEqual([
      "date-fns",
      "react-day-picker",
      "@tanstack/react-table",
      "zod",
    ])
  })
})

describe("chunk boundary lookup", () => {
  const chunkSizes = {
    "assets/index-abc.js": 731_557,
    "assets/vendor-react-def.js": 178_000,
    "assets/tasks-123.js": 12_000,
  }

  const manifest = {
    "index.html": { file: "assets/index-abc.js", isEntry: true },
  }

  const report = {
    "assets/index-abc.js": [
      "/repo/apps/web/src/main.tsx",
      "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js",
    ],
    "assets/vendor-react-def.js": [
      "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js",
    ],
  }

  it("reports only chunks above the size limit", () => {
    expect(findOversizedChunks(chunkSizes, 500_000)).toEqual([
      { file: "assets/index-abc.js", bytes: 731_557 },
    ])
    expect(findOversizedChunks(chunkSizes, 800_000)).toEqual([])
  })

  it("finds the entry chunk and its modules", () => {
    expect(findEntryChunk(manifest, report)).toEqual({
      file: "assets/index-abc.js",
      modules: report["assets/index-abc.js"],
    })
  })

  it("returns null when the manifest has no entry", () => {
    expect(findEntryChunk({}, report)).toBeNull()
    expect(findEntryChunk(manifest, {})).toEqual({
      file: "assets/index-abc.js",
      modules: [],
    })
  })

  it("separates vendor modules from first-party ones", () => {
    expect(findVendorModules(report["assets/index-abc.js"])).toEqual([
      "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js",
    ])
  })
})

function vendorReport() {
  return {
    "assets/index-abc.js": ["/repo/apps/web/src/main.tsx"],
    "assets/vendor-react-a.js": [
      "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js",
    ],
    "assets/vendor-base-ui-a.js": [
      "/repo/node_modules/.pnpm/@base-ui+react@1.9.0/node_modules/@base-ui/react/index.js",
    ],
    "assets/vendor-refine-a.js": [
      "/repo/node_modules/.pnpm/@refinedev+core@5.0.12/node_modules/@refinedev/core/index.js",
    ],
    "assets/vendor-router-a.js": [
      "/repo/node_modules/.pnpm/react-router@7.18.5/node_modules/react-router/index.js",
    ],
    "assets/vendor-i18n-a.js": [
      "/repo/node_modules/.pnpm/i18next@26.7.2/node_modules/i18next/index.js",
    ],
    "assets/vendor-sonner-a.js": [
      "/repo/node_modules/.pnpm/sonner@2.0.8/node_modules/sonner/index.js",
    ],
    "assets/vendor-misc-a.js": [
      "/repo/node_modules/.pnpm/next-themes@0.4.6/node_modules/next-themes/index.js",
    ],
  }
}

function vendorSizes() {
  return Object.fromEntries(
    Object.keys(vendorReport()).map((file) => [file, 10_000])
  )
}

describe("vendor family assertions", () => {
  it("accepts one chunk per family, each containing its package", () => {
    expect(() =>
      assertVendorFamilies({
        report: vendorReport(),
        sizes: vendorSizes(),
      })
    ).not.toThrow()
  })

  it("rejects a missing family chunk", () => {
    const report = vendorReport()
    delete (report as Record<string, string[]>)["assets/vendor-sonner-a.js"]

    expect(() =>
      assertVendorFamilies({ report, sizes: vendorSizes() })
    ).toThrow(/vendor-sonner/)
  })

  it("rejects a family chunk that contains none of its packages", () => {
    const report = vendorReport()
    report["assets/vendor-react-a.js"] = [
      "/repo/node_modules/.pnpm/react-hook-form@7.91/node_modules/react-hook-form/index.js",
    ]

    expect(() =>
      assertVendorFamilies({ report, sizes: vendorSizes() })
    ).toThrow(/vendor-react.*no react package/i)
  })

  it("rejects a family chunk above maxSize", () => {
    const sizes = vendorSizes()
    sizes["assets/vendor-react-a.js"] = 300_000

    expect(() =>
      assertVendorFamilies({ report: vendorReport(), sizes })
    ).toThrow(/vendor-react.*300000/)
  })

  it("checks every chunk split from one family", () => {
    const report = vendorReport()
    report["assets/vendor-react-b.js"] = [
      "/repo/node_modules/.pnpm/react-dom@19.2.6/node_modules/react-dom/index.js",
    ]
    const sizes = vendorSizes()
    sizes["assets/vendor-react-b.js"] = 300_000

    expect(() => assertVendorFamilies({ report, sizes })).toThrow(
      /vendor-react-b\.js.*300000/
    )
  })

  it("rejects a family chunk with no recorded size", () => {
    const sizes = vendorSizes()
    delete sizes["assets/vendor-sonner-a.js"]

    expect(() =>
      assertVendorFamilies({ report: vendorReport(), sizes })
    ).toThrow(/vendor-sonner-a\.js has no recorded size/)
  })
})

describe("chunk boundary assertions", () => {
  const manifest = {
    "index.html": { file: "assets/index-abc.js", isEntry: true, imports: [] },
  }

  it("accepts an app-only entry and a warning-free build", () => {
    expect(() =>
      assertChunkBoundaries({
        manifest,
        report: vendorReport(),
        sizes: vendorSizes(),
      })
    ).not.toThrow()
  })

  it("rejects an emitted chunk above the warning limit", () => {
    const sizes = vendorSizes()
    sizes["assets/vendor-base-ui-a.js"] = 500_001

    expect(() =>
      assertChunkBoundaries({
        manifest,
        report: vendorReport(),
        sizes,
      })
    ).toThrow(/500001/)
  })

  it("rejects vendor modules inside the entry chunk", () => {
    const report = vendorReport()
    report["assets/index-abc.js"] = [
      "/repo/apps/web/src/main.tsx",
      "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js",
    ]

    expect(() =>
      assertChunkBoundaries({ manifest, report, sizes: vendorSizes() })
    ).toThrow(/entry.*node_modules/i)
  })

  it("rejects an entry chunk at or above its app-code ceiling", () => {
    for (const bytes of [150_000, 150_001]) {
      const sizes = vendorSizes()
      sizes["assets/index-abc.js"] = bytes

      expect(() =>
        assertChunkBoundaries({
          manifest,
          report: vendorReport(),
          sizes,
        })
      ).toThrow(/entry.*15000/)
    }
  })

  it("rejects an entry chunk with no recorded size", () => {
    const sizes = vendorSizes()
    delete sizes["assets/index-abc.js"]

    expect(() =>
      assertChunkBoundaries({
        manifest,
        report: vendorReport(),
        sizes,
      })
    ).toThrow(/index-abc\.js has no recorded size/)
  })
})

describe("initial closure assertions", () => {
  const manifest = {
    "index.html": {
      file: "assets/index-abc.js",
      isEntry: true,
      imports: ["_vendor-react-abc.js"],
      dynamicImports: ["src/routes/tasks.tsx"],
    },
    "_vendor-react-abc.js": {
      file: "assets/vendor-react-abc.js",
      imports: [],
    },
    "src/routes/tasks.tsx": {
      file: "assets/tasks-123.js",
      isDynamicEntry: true,
      imports: ["_date-abc.js"],
    },
    "_date-abc.js": { file: "assets/date-abc.js" },
  }

  const report = {
    "assets/index-abc.js": ["/repo/apps/web/src/main.tsx"],
    "assets/vendor-react-abc.js": [
      "/repo/node_modules/.pnpm/react@19.2.6/node_modules/react/index.js",
    ],
    "assets/tasks-123.js": ["/repo/apps/web/src/routes/tasks.tsx"],
    "assets/date-abc.js": [
      "/repo/node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/index.js",
    ],
  }

  const html =
    '<link rel="modulepreload" href="/assets/vendor-react-abc.js">' +
    '<script type="module" src="/assets/index-abc.js"></script>'

  it("reads the static import closure from the manifest", () => {
    expect(() =>
      assertInitialClosure({ manifest, html, report })
    ).not.toThrow()
  })

  it("rejects the shared components index in the initial closure", () => {
    const leaked = {
      ...report,
      "assets/index-abc.js": [
        "/repo/apps/web/src/main.tsx",
        "/repo/packages/shared-lib/src/components/index.ts",
      ],
    }

    expect(() =>
      assertInitialClosure({ manifest, html, report: leaked })
    ).toThrow(/shared components index/i)
  })

  it("accepts a direct shared-lib subpath module in the initial closure", () => {
    const direct = {
      ...report,
      "assets/index-abc.js": [
        "/repo/apps/web/src/main.tsx",
        "/repo/packages/shared-lib/src/components/table-page-layout.tsx",
      ],
    }

    expect(() =>
      assertInitialClosure({ manifest, html, report: direct })
    ).not.toThrow()
  })

  it("rejects a forbidden package in a closure chunk", () => {
    const leaked = {
      ...report,
      "assets/vendor-react-abc.js": [
        "/repo/node_modules/.pnpm/date-fns@4.4.0/node_modules/date-fns/index.js",
      ],
    }

    expect(() =>
      assertInitialClosure({ manifest, html, report: leaked })
    ).toThrow(/date-fns/)
  })

  it("rejects a preload outside the initial closure", () => {
    const leakingHtml =
      html + '<link rel="modulepreload" href="/assets/tasks-123.js">'

    expect(() =>
      assertInitialClosure({ manifest, html: leakingHtml, report })
    ).toThrow(/tasks-123\.js/)
  })

  it("rejects a missing preload for a closure chunk", () => {
    const waterfallHtml =
      '<script type="module" src="/assets/index-abc.js"></script>'

    expect(() =>
      assertInitialClosure({ manifest, html: waterfallHtml, report })
    ).toThrow(/vendor-react-abc\.js has no preload/)
  })

  it("collects script and modulepreload URLs", () => {
    expect(findReferencedScripts(html)).toEqual([
      "assets/index-abc.js",
      "assets/vendor-react-abc.js",
    ])
  })
})

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
