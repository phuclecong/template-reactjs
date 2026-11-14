import path from "path"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Emit `.vite/manifest.json` so route-chunk separation and the
    // "no chunk requested at startup" contract can be verified from the
    // production build rather than inferred from source imports.
    manifest: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // pnpm monorepo: `@workspace/ui` and `@workspace/shared-lib` are linked via
    // symlink and each declares its own `react`/`react-dom`. Force a single
    // instance so hooks dispatch against one React (avoids "invalid hook call").
    dedupe: ["react", "react-dom"],
  },
})
