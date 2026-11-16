import { onCLS } from "web-vitals/onCLS.js"
import { onINP } from "web-vitals/onINP.js"
import { onLCP } from "web-vitals/onLCP.js"

import { reportMetric } from "./logger"

/**
 * Registers field Web Vitals once. It must be called outside React (from
 * `main.tsx`) so StrictMode cannot double-register. `web-vitals` finalizes each
 * metric and calls back, including on page hide; no listener is added here.
 *
 * Only the three callbacks are imported from their subpaths rather than the
 * package entry point, to keep the initial bundle small.
 */
export function installWebVitals(): void {
  onLCP((metric) => {
    reportMetric({ name: "LCP", value: metric.value, rating: metric.rating })
  })
  onCLS((metric) => {
    reportMetric({ name: "CLS", value: metric.value, rating: metric.rating })
  })
  onINP((metric) => {
    reportMetric({ name: "INP", value: metric.value, rating: metric.rating })
  })
}
