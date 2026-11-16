import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

/**
 * LHCI launches two kinds of browser:
 *   - with `puppeteerScript`, it launches Puppeteer and Lighthouse reuses that
 *     browser, so `puppeteerLaunchOptions.args` are the audit browser's flags;
 *   - without one, Lighthouse launches Chrome itself and only
 *     `settings.chromeFlags` reach it.
 *
 * GitHub Actions disables unprivileged user namespaces, so the audit browser
 * must always receive `--no-sandbox`. The SEO config regressed this once: it
 * set `puppeteerLaunchOptions` with no script, so the flag never arrived.
 */
type CollectConfig = {
  puppeteerScript?: string
  puppeteerLaunchOptions?: { args?: string[] }
  settings?: { chromeFlags?: string }
}

type LighthouseConfig = { ci: { collect: CollectConfig } }

const require = createRequire(import.meta.url)

function auditBrowserFlags(config: LighthouseConfig): string[] {
  const { collect } = config.ci
  if (collect.puppeteerScript) {
    return collect.puppeteerLaunchOptions?.args ?? []
  }
  return (collect.settings?.chromeFlags ?? "")
    .split(/\s+/)
    .filter(Boolean)
}

const configs: [name: string, config: LighthouseConfig][] = [
  ["performance", require("../lighthouserc.cjs") as LighthouseConfig],
  ["SEO", require("../lighthouserc.seo.cjs") as LighthouseConfig],
]

describe.each(configs)("%s Lighthouse config", (_name, config) => {
  it("gives the audit browser --no-sandbox", () => {
    expect(auditBrowserFlags(config)).toContain("--no-sandbox")
  })
})
