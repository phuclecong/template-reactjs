# SEO metadata is emitted at build time from the route table

**Status**: accepted

The app is a static SPA served by one `index.html`, but link-preview crawlers do not run JavaScript, so per-route **Page metadata** cannot be produced on the client. Metadata is therefore declared once in a typed route table and the build emits a real HTML file per **Public route** with its head filled in, plus `robots.txt` and `sitemap.xml`; the catch-all `index.html` carries a default head with `noindex` and no canonical. The client reconciles the same tags on navigation, keyed to the tags the build wrote, so there is one metadata source and two writers that cannot disagree about which tag is which.

## Considered Options

- **Render per request (SSR or full prerender)**: real crawlable body content as well as head, but it means a rendering framework change for an authenticated dashboard whose only indexable pages are two forms. Rejected for this feature.
- **Client-only head management** (React 19's native `<title>`/`<meta>` hoisting): simplest, and Google's JS rendering would see it, but Slack, Twitter/X, LinkedIn, and Facebook would not — the "shareable" half of the goal stays broken. Rejected.
- **Edge middleware that serves bot-specific HTML by user-agent**: keeps one artifact, but user-agent sniffing is fragile, invisible to local verification, and ties the output to the host. Rejected.
- **Static defaults in `index.html` only**: accurate for no page, so every public route would advertise the same title, description, and canonical. Rejected.

## Consequences

- The build grows more artifacts than `index.html`: one flat HTML file per public route, plus `robots.txt` and `sitemap.xml`. The host config must rewrite each public path before the catch-all, and set a per-path `X-Robots-Tag` for the dashboard.
- `SITE_URL` becomes a required build input at deploy time. It is build-time only and never reaches the browser; the client derives canonical URLs from `window.location.origin` so previews and localhost stay correct.
- Adding a public route is a compile error until its metadata entry exists, because the route table is typed against the same union the router uses. It also needs a rewrite entry.
- Metadata copy is English-only: the locale is resolved client-side, so one static document can only carry one language. Translated metadata and `hreflang` require URL locale segments — a routing decision, not a metadata one.
- The dashboard and unknown paths are excluded at the crawl layer (robots rule, response header, default head), not by rendering or by client-written meta tags.
- Because the client rewrites tags the build wrote, every emitted tag carries a stable `data-seo` key. That key is the contract between the two writers and must not be renamed casually.
