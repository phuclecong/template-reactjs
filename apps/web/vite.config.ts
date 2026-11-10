import path from "path"
import { defineConfig, loadEnv } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const apiUrl = env.VITE_API_URL

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // pnpm monorepo: `@workspace/ui` and `@workspace/shared-lib` are linked via
      // symlink and each declares its own `react`/`react-dom`. Force a single
      // instance so hooks dispatch against one React (avoids "invalid hook call").
      dedupe: ["react", "react-dom"],
    },
    // When a real backend is configured, proxy the browser's `/api/*` requests
    // to it in dev (no CORS). In mock mode this is undefined and the in-browser
    // MSW worker serves `/api/*` instead.
    server: {
      proxy: apiUrl
        ? {
            "/api": {
              target: apiUrl,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
