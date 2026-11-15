import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@workspace/ui/globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  installUnhandledRejectionReporter,
  reportError,
} from "@/utils/error-reporting"
import { App } from "./App.tsx"

installUnhandledRejectionReporter()

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error, info) => reportError(error, info),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
