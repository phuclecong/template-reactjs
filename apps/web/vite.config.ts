import path from "path"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Emit `.vite/manifest.json` so route-chunk separation, preloads, and the
    // "no chunk requested at startup" contract can be verified from the
    // production build rather than inferred from source imports.
    manifest: true,
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
