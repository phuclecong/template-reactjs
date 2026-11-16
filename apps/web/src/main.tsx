import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@workspace/ui/globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  installUnhandledRejectionReporter,
  installWebVitals,
  reportError,
} from "@/observability"
import { App } from "./App.tsx"

installUnhandledRejectionReporter()
installWebVitals()

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error, info) => reportError(error, info),
  onCaughtError: (error, info) => reportError(error, info),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
