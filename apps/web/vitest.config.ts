import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `@refinedev/react-table` imports the extensionless CommonJS subpath
      // `lodash/isEqual`; Vite's ESM resolver requires the file extension.
      "lodash/isEqual": "lodash/isEqual.js",
    },
    // Linked workspace packages must share the app's `react-i18next` instance;
    // otherwise their `useTranslation` sees a different provider context.
    dedupe: ["react", "react-dom", "react-i18next"],
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    server: {
      // Transform this package rather than externalizing it, so the
      // `lodash/isEqual` alias above applies.
      deps: { inline: ["@refinedev/react-table"] },
    },
  },
})
