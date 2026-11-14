import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // Linked workspace packages must share the app's `react-i18next` instance;
    // otherwise their `useTranslation` sees a different provider context.
    dedupe: ["react", "react-dom", "react-i18next"],
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
  },
})
