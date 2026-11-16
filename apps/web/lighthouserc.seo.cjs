/**
 * Lighthouse SEO gate for the public routes on the production build.
 *
 * Run by `pnpm perf` (scripts/perf/run.mjs) alongside the performance pass:
 *   1. `vite build`
 *   2. start `vite preview` on port 4173
 *   3. run `lhci collect` once per public route (`/login`, `/register`)
 *   4. run `lhci assert` with `categories:seo` = 1.0, and print the score and
 *      any failing audit per route
 *
 * ONE COLD RUN PER ROUTE IS DELIBERATE. ADR-0010 requires three runs for the
 * performance budgets because timing varies between runs; the Lighthouse SEO
 * score has no timing component, so a median buys nothing. See seo.md §6.
 * Each collect invocation launches a fresh browser (fresh profile, empty
 * cache), so the single run is still cold.
 *
 * `lhci collect` always writes to `<cwd>/.lighthouseci` (it has no output-dir
 * flag), so `scripts/perf/run.mjs` runs the SEO collect and assert commands
 * with `apps/web/.lighthouseci-seo` as their cwd. That keeps SEO reports out
 * of the performance reports in `apps/web/.lighthouseci`, so they never leak
 * into the performance assertion set or the JS/CSS byte budgets.
 * `perf-budgets.json` is unchanged.
 */
module.exports = {
  ci: {
    collect: {
      // Defaults for a bare `lhci collect`; `pnpm perf` passes one `--url` per
      // cold run so each route gets its own browser.
      url: ["http://localhost:4173/login", "http://localhost:4173/register"],
      numberOfRuns: 1,
      settings: {
        // GitHub Actions disables unprivileged user namespaces, so the Chrome
        // that Lighthouse launches itself needs these flags. Unlike the
        // performance config, this run has no puppeteerScript for LHCI to
        // reuse, so `puppeteerLaunchOptions` would not reach the audit browser.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
        // The SEO category is enough; collecting performance here would add
        // noise and is already covered by lighthouserc.cjs.
        onlyCategories: ["seo"],
      },
    },
    assert: {
      assertions: {
        // The gate: a perfect SEO score on every public route is blocking.
        // scripts/perf/run.mjs names the individual failing audits.
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: {
      // Never used by `pnpm perf` (no `lhci upload` step); kept local. The
      // path is relative to the isolated cwd described above.
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
}
