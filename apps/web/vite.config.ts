import path from "path"
import { defineConfig, type Plugin } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

import { VENDOR_CODE_SPLITTING } from "./scripts/perf/vendor-groups.mjs"

/**
 * Records which modules landed in each emitted chunk. `build.manifest` lists
 * chunk files and imports but not module membership, and the build-output gate
 * must prove the entry chunk carries no vendor code. Emitted only when
 * `CHUNK_REPORT=1` (set by `verify:real-build`); production builds do not ship
 * the report, which contains absolute module paths.
 */
function chunkReportPlugin(): Plugin {
  return {
    name: "chunk-report",
    generateBundle(_options, bundle) {
      if (process.env.CHUNK_REPORT !== "1") return

      const report: Record<string, string[]> = {}
      for (const [file, output] of Object.entries(bundle)) {
        if (output.type === "chunk" && file.endsWith(".js")) {
          report[file] = Object.keys(output.modules)
        }
      }
      this.emitFile({
        type: "asset",
        fileName: ".vite/chunk-report.json",
        source: JSON.stringify(report),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), chunkReportPlugin()],
  build: {
    // Emit `.vite/manifest.json` so route-chunk separation, preloads, and the
    // "no chunk requested at startup" contract can be verified from the
    // production build rather than inferred from source imports.
    manifest: true,
    rolldownOptions: {
      output: {
        // Family vendor chunks, `$initial` only. Group definitions are shared
        // with the verifier so the split and its gate cannot drift. See
        // `docs/features/improve-performance.md` and ADR-0017.
        codeSplitting: VENDOR_CODE_SPLITTING,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // MSW's browser build eagerly constructs a cookie jar backed by
      // `tough-cookie` -> `tldts` (250 kB minified) even though the mock API
      // never uses cookies. Alias it to an inert jar so the mock worker stays
      // off the critical path. See `src/utils/stubs/tough-cookie.ts`.
      "tough-cookie": path.resolve(
        __dirname,
        "./src/utils/stubs/tough-cookie.ts"
      ),
      // `simple-rest` imports axios even though this app passes the fetch
      // client in `@/utils/http-client`. The stub satisfies module evaluation
      // and throws if the unused default transport is ever called.
      axios: path.resolve(__dirname, "./src/utils/stubs/axios.ts"),
      // `@refinedev/core` also imports papaparse eagerly for its unused
      // `useExport` hook. The stub throws if export is ever invoked.
      papaparse: path.resolve(__dirname, "./src/utils/stubs/papaparse.ts"),
    },
    // pnpm monorepo: `@workspace/ui` and `@workspace/shared-lib` are linked via
    // symlink and each declares its own `react`/`react-dom`. Force a single
    // instance so hooks dispatch against one React (avoids "invalid hook call").
    // `react-i18next` is deduped too so linked packages share one provider
    // context instead of resolving a second copy with no initialized instance.
    dedupe: ["react", "react-dom", "react-i18next"],
  },
})
