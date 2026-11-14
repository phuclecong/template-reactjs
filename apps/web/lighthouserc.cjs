/**
 * Lighthouse CI configuration for the production build.
 *
 * `pnpm perf` (scripts/perf/run.mjs) owns the lifecycle:
 *   1. `vite build`
 *   2. start `vite preview` on port 4173
 *   3. run `lhci collect` once per URL per run (3 cold runs each)
 *   4. run `lhci assert` over the collected reports
 *   5. run `scripts/perf/budget.mjs`
 *
 * Cold context: `lhci collect` launches a fresh Puppeteer browser (fresh
 * profile, empty cache) for every invocation. The orchestrator runs collect
 * once per run instead of `numberOfRuns: 3` in a single invocation, because a
 * single invocation reuses one browser across its runs. One URL per invocation
 * also prevents the `/login` audit from warming the cache for `/dashboard/tasks`.
 * `scripts/perf/login.cjs` only injects the session into the audited target;
 * it never loads the app, registers the service worker, or seeds localStorage.
 */
module.exports = {
  ci: {
    collect: {
      // Defaults for a bare `lhci collect`; `pnpm perf` passes one `--url` per
      // cold run. Both are required by the measurement contract (§5).
      url: [
        "http://localhost:4173/login",
        "http://localhost:4173/dashboard/tasks",
      ],
      numberOfRuns: 1,
      puppeteerScript: "./scripts/perf/login.cjs",
      puppeteerLaunchOptions: {
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      },
      settings: {
        // Lighthouse's mobile emulation: simulated Slow 4G and 4x CPU
        // slowdown. Values match Lighthouse's `mobileSlow4G` preset.
        formFactor: "mobile",
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
          cpuSlowdownMultiplier: 4,
        },
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        // The dashboard route needs the sessionStorage value the login step
        // injects with `evaluateOnNewDocument`. Coldness still comes from a
        // fresh browser profile per collect invocation: no localStorage seed,
        // no service worker, and no warmed `/api` cache before the audit.
        disableStorageReset: true,
        onlyCategories: ["performance"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 0.85, aggregationMethod: "median" },
        ],
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: 3500, aggregationMethod: "median" },
        ],
      },
    },
    upload: {
      // Reports stay local; `pnpm perf` never uploads to an LHCI server.
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
}
