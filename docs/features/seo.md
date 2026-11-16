# Search engine optimization

**Status**: accepted
**Tracking**: spec [#48](https://github.com/phuclecong/template-reactjs/issues/48); work items [#49](https://github.com/phuclecong/template-reactjs/issues/49)–[#54](https://github.com/phuclecong/template-reactjs/issues/54)
**Decision records**: `docs/adr/0014-seo-metadata-emitted-at-build-time.md`
**Related**: `docs/features/requirement.md`, `performance.md`, `docs/deployment.md`, ADR-0004 (client-side i18n), ADR-0010 (production measurement)

## 1. Summary

The app is correct for search engines and link-preview tools on its public surface — `/login` and `/register` — and provably excluded everywhere else. Each **Public route** is emitted at build time as a real HTML file whose head carries its **Page metadata**; the catch-all `index.html` that serves the dashboard carries a default head with `noindex` and no canonical. `robots.txt` and `sitemap.xml` are generated from the same route table, and `vercel.json` marks the dashboard `noindex` at the response level.

What this feature does **not** claim is organic discoverability. The dashboard has no crawlable content: every page behind it requires a signed-in User. Search ranking is therefore not a goal, and the success measure is a green Lighthouse SEO score plus correct tags in raw, non-JS HTML (§6).

No live host exists in this repository (`docs/deployment.md`), so link-preview-debugger verification is recorded as pending one.

## 2. Why the previous reference is not a baseline

The report that prompted this work was a Chrome DevTools Lighthouse run against `http://localhost:5173` — the Vite **dev server** — on `/dashboard/tasks`. Under ADR-0010 it is not evidence: the dev server measures Vite's module graph, not the built artifact. It also measured the wrong route: `/dashboard/tasks` is a **Protected route** that this feature deliberately excludes from the index. The report file has been deleted and is not cited as evidence anywhere in this document.

Its findings are still the reasons this document exists, and they are recorded here in prose rather than as a score:

| Finding               | What it means here                                                   |
| --------------------- | -------------------------------------------------------------------- |
| `meta-description`: 0 | No description anywhere; no page has metadata of its own             |
| `robots-txt`: invalid | `/robots.txt` falls through the SPA rewrite and returns `index.html` |
| SEO score 0.82        | A dev-server number with no relationship to the production build     |

The report has been deleted; §7.6 records the measurements of the real artifact instead. The same report's accessibility (`label-content-name-mismatch`) and favicon findings are separate issues, not part of this feature (§4).

## 3. What is actually indexable

- **Public routes** — `/login`, `/register`: indexable, with full Page metadata and sitemap entries.
- **Protected routes** — `/dashboard/tasks`, `/dashboard/users`, `/dashboard/settings`: `noindex` at the crawl layer, no canonical, no sitemap entry, no structured data.
- **`/`** — a client-side redirect to `/dashboard`, which bounces unauthenticated visitors to `/login`. No content of its own, so it is not indexable and not in the sitemap; `/login` is the canonical entry point.
- **Unknown paths** — served the catch-all `index.html`, which carries `noindex`.

## 4. Goals and non-goals

**Goals**

- Emit accurate Page metadata for every Public route in the initial HTML, where non-JS crawlers can read it.
- Give shared public links a consistent social preview with absolute URLs.
- Keep the dashboard, `/`, and unknown paths out of the index by two independent mechanisms (robots rule and response header).
- Generate `robots.txt` and `sitemap.xml` from the routing table so they cannot drift from it.
- Hold all of it green in CI on the production build.

**Non-goals**

- Server-side rendering or a prerendered body. The body stays a client-rendered SPA; only the head is templated.
- Organic-ranking work, public content pages, or per-entity structured data for Tasks and Users — those entities are not reachable without a session.
- Localized metadata and `hreflang`. Locale is resolved client-side (ADR-0004), so one static document carries one language; translated metadata needs URL locale segments, a routing decision for a separate feature.
- 404 semantics. Unknown paths still return `index.html` with status 200; they are excluded from the index, not turned into 404s.
- The accessibility `label-content-name-mismatch` and favicon findings from the same Lighthouse report.
- Build-time OG image generation; 7.4 checks in a static placeholder.

## 5. Metadata contract

### 5.1 Source of truth

`apps/web/src/routes/route-metadata.ts` exports `Record<RoutePath, RouteMetadata>`, typed against the `RoutePath` union in `route-loaders.ts` — the same union `App` uses for its lazy imports and intent prefetching. Adding a route without metadata, or metadata for a non-route, fails `tsc`.

Each entry carries a title, a description, and `indexable: boolean`. Public routes also carry the canonical path and social-preview copy; Protected routes carry a title for the browser tab only and are never emitted as files.

### 5.2 Emitted head

Every public HTML file contains exactly these, with absolute URLs derived from `SITE_URL`:

| Field                                                   | `/login`                                                                  | `/register`                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `title`                                                 | `Sign in \| Dashboard`                                                    | `Create an account \| Dashboard` |
| `description`                                           | page purpose                                                              | page purpose                     |
| `canonical`                                             | `{SITE_URL}/login`                                                        | `{SITE_URL}/register`            |
| `robots`                                                | `index, follow`                                                           | `index, follow`                  |
| `og:title`                                              | route title                                                               | route title                      |
| `og:description`                                        | route description                                                         | route description                |
| `og:url`                                                | canonical                                                                 | canonical                        |
| `og:type`                                               | `website`                                                                 | `website`                        |
| `og:site_name`                                          | `Dashboard`                                                               | `Dashboard`                      |
| `og:image`                                              | `{SITE_URL}/og-image.png` plus `og:image:alt`, `width` 1200, `height` 630 | same                             |
| `twitter:card`                                          | `summary_large_image`                                                     | `summary_large_image`            |
| `twitter:title`, `twitter:description`, `twitter:image` | route copy                                                                | route copy                       |
| JSON-LD                                                 | `WebApplication` (name, description, url)                                 | same                             |

No `twitter:site` or `twitter:creator`: the template has no account, and inventing one produces a broken handle. No `og:locale`: the document may render in either locale, so no single value is accurate.

Site name is `Dashboard`, matching the app-wide title and `shell.title` in both translation files. Canonical URLs are `SITE_URL` + the exact route path: no trailing slash, no case normalization. The canonical, `og:url`, and sitemap entry for a route are the same string by construction.

### 5.3 Catch-all head

`index.html` serves `/dashboard/*`, `/`, and unknown paths, so its head cannot carry a canonical or `og:url` — either would be asserted for every path it serves. It carries the site title (`Dashboard`), the site description, the social tags minus `og:url`, and `<meta name="robots" content="noindex">`, with no JSON-LD.

### 5.4 Crawl policy

- `robots.txt` is generated at build: `User-agent: *`, `Allow: /`, `Disallow: /dashboard/`, and `Sitemap: {SITE_URL}/sitemap.xml`.
- `apps/web/vercel.json` sets `X-Robots-Tag: noindex` for `/dashboard/:path*`, which the crawler sees on the HTML response itself.
- `sitemap.xml` is generated at build and lists exactly `{SITE_URL}/login` and `{SITE_URL}/register`. No `lastmod`: with a mock backend and no content updates, it would be fabricated.
- Client-written `<meta name="robots">` is not relied on for exclusion — it is invisible to a non-JS crawler and unusable for a crawler already told not to fetch. Header and robots rule agree because these routes are never intended to be indexed.

### 5.5 Site URL

`SITE_URL` is a build-time-only environment variable, used for canonical, `og:url`, OG image, sitemap, and robots URLs. It is never shipped to the browser: the client builds canonical URLs from `window.location.origin`, so a preview deployment or localhost is self-correcting. When `SITE_URL` is unset the build uses `http://localhost:4173` and prints a warning; `docs/deployment.md` records that deploy configuration must set it.

### 5.6 Mechanism

- **Build.** A Vite plugin in `apps/web/vite.config.ts` (implementation in its own module) templates the built `index.html` into `dist/login.html` and `dist/register.html` at `closeBundle`, and writes `dist/robots.txt` and `dist/sitemap.xml`. Because it runs inside `vite build`, `vite preview`, `pnpm perf`, and CI's build step all pick the artifacts up without extra wiring.
- **Host.** `vercel.json` rewrites `/login` → `/login.html` and `/register` → `/register.html` ahead of the `/(.*)` → `/index.html` catch-all.
- **Dev parity.** The same head-building function serves a Vite dev middleware that injects the per-route head for public paths, so local view-source matches the build.
- **Client.** A single `<RouteMetadata>` mounted under `App` resolves `useLocation()` through the same route table and reconciles the head imperatively: every emitted tag carries a stable `data-seo` key, and the component updates it in place, creates it if missing (dev, unknown paths), and removes `noindex` when navigating to a public route. React 19's native document-metadata hoisting is not used, because React cannot see tags the build wrote and would leave a second, stale `description`.

## 6. Measurement contract

- **Artifact**: `vite build` + `vite preview` (ADR-0010). The dev server is never evidence.
- **Routes**: `/login` and `/register` — the indexable surface. The dashboard is not audited for SEO; its `noindex` header is config-asserted (`vite preview` does not apply `vercel.json` headers).
- **Runs**: one cold run per route. Lighthouse's SEO score has no timing component, so a median buys nothing; this is a deliberate, documented deviation from ADR-0010's three-run rule for performance.
- **Gate**: Lighthouse `categories:seo` = 1.0, blocking, on both routes, wired into `apps/web/scripts/perf/run.mjs` as an SEO pass alongside the performance pass. A score below 1.0 names the failing audit; it is fixed or documented, never hidden behind a lower threshold.
- **Contract script**: `apps/web/scripts/seo/verify.mjs` (the style of `scripts/perf/budget.mjs`) is blocking in CI and asserts, from the built `dist/`:
  - `login.html` and `register.html` contain every tag in §5.2, with absolute URLs and no duplicates;
  - `index.html` contains the §5.3 head and no canonical;
  - `robots.txt` and `sitemap.xml` match §5.4 exactly;
  - `vercel.json` declares the two rewrites before the catch-all and the dashboard `X-Robots-Tag` header.
    This is the only check that proves the tags exist for a non-JS crawler; Lighthouse runs JavaScript and cannot tell templated head from client-written head.
- **Byte budgets**: unchanged. The added head is markup, and the OG image is referenced but never loaded, so neither counts against the JS/CSS budgets. The client reconciliation component is the only JS addition; its cost is measured and must stay under the existing ceilings in `apps/web/perf-budgets.json`.
- **Link previews**: verification with a real debugger is **pending a host**. The evidence run uses `SITE_URL=http://localhost:4173`, which proves the build emits absolute, correctly derived URLs but cannot be resolved by an external debugger.

## 7. Work items

### 7.1 Route metadata and build-time head templating

Add `route-metadata.ts` typed against `RoutePath`; read `SITE_URL`; add the Vite plugin that emits the public HTML and serves the dev middleware (`robots.txt` and `sitemap.xml` follow in 7.3); order the `vercel.json` rewrites; document `SITE_URL` in `docs/deployment.md`.

**Acceptance**

- A route missing from the metadata record fails typecheck, and so does an entry for a non-route.
- `vite build` emits `dist/login.html` and `dist/register.html` with the §5.2 head, except the social-preview image tags, which 7.4 adds; and `dist/index.html` with the §5.3 head.
- `vite dev` serves the per-route head for public paths.
- No `SITE_URL` value appears in any client bundle.
- `/login` and `/register` resolve to their own HTML under `vite preview`; every other path resolves to `index.html`.

### 7.2 Client head reconciliation

Add `<RouteMetadata>` under `App`; key every emitted tag with `data-seo`; update on navigation, create when missing, and add or remove `noindex` according to the destination route.

**Acceptance**

- Navigating between public routes and the dashboard updates title, description, canonical, `og:url`, and robots to the destination's metadata.
- Exactly one tag exists per key after any navigation sequence; no stale description or canonical survives.
- Canonical uses `window.location.origin` and the destination path.
- Unit tests cover reconciliation in jsdom; an e2e assertion covers a dashboard → public navigation.

### 7.3 Crawl controls

Generate `robots.txt` and `sitemap.xml` in the build; add the `X-Robots-Tag` header for `/dashboard/:path*`; set the catch-all `noindex`.

**Acceptance**

- Emitted `robots.txt` and `sitemap.xml` match §5.4 byte-for-byte for a given `SITE_URL`.
- `vercel.json` declares the header for `/dashboard/:path*`.
- `dist/index.html` carries `noindex` and no canonical or `og:url`.
- The sitemap contains exactly the two public URLs, with no `lastmod`.

### 7.4 Social preview

Check in a 1200×630 placeholder `og-image` under `apps/web/public/`; emit the OG and Twitter tag set from §5.2 with absolute URLs.

**Acceptance**

- Both public HTML files reference the image by absolute URL and declare `twitter:card=summary_large_image`.
- No image request is added to first paint; the performance harness results are unchanged.

### 7.5 Verification harness

Add `scripts/seo/verify.mjs` and a `verify:seo` package script; add the blocking SEO Lighthouse pass on the public routes to `scripts/perf/run.mjs`; wire both into CI.

**Acceptance**

- `verify:seo` passes on a clean build and fails, naming the missing tag or mismatched file, when any §5.2–§5.4 item is removed.
- `pnpm perf` reports the SEO score for `/login` and `/register` and fails below 1.0.
- CI runs both checks on every pull request.

### 7.6 Measurement and documentation

Record the production-build evidence here, delete the dev-server report, and confirm the performance budgets are unchanged.

**Acceptance**: the §8 done condition.

**Evidence — measured 2026-11-16.**

Run: `SITE_URL=http://localhost:4173 pnpm --filter web perf` against the production artifact (`tsc -b && vite build`, served by `vite preview` on port 4173, never the dev server), with system Chrome. The harness exited 0.

Lighthouse SEO, one cold run per public route:

| Route       | SEO score | Result |
| ----------- | --------: | ------ |
| `/login`    |      1.00 | PASS   |
| `/register` |      1.00 | PASS   |

**Canonical origin used:** `SITE_URL=http://localhost:4173`. The emitted canonical, `og:url`, `og:image`, robots `Sitemap:` line, and sitemap entries all derive from it; `verify:seo` passes for that origin.

Byte budgets (Lighthouse `transferSize`, median of three cold runs), against the unchanged `apps/web/perf-budgets.json`:

| Route             | Metric | Measured | Ceiling | Headroom | Result |
| ----------------- | ------ | -------: | ------: | -------: | ------ |
| `/login`          | JS     |  305,670 | 315,333 |    9,663 | PASS   |
| `/login`          | CSS    |   14,869 |  14,875 |        6 | PASS   |
| `/dashboard/tasks`| JS     |  542,173 | 560,228 |   18,055 | PASS   |
| `/dashboard/tasks`| CSS    |   14,869 |  14,875 |        6 | PASS   |

`perf-budgets.json` was not re-ratcheted. The client reconciliation component is included in the measured JS figures, adds no separate chunk, and fits the existing ceilings with 9,663 bytes of JS headroom on `/login` and 18,055 bytes on `/dashboard/tasks`.

**CSS budget fix.** The only budget pressure came from Tailwind v4 scanning two source comments: the bare words `shadow` and `transform` were treated as class candidates and emitted unused `.shadow` and `.transform` utilities. Rewording the comments removed them with no behaviour change. The emitted stylesheet went from `index-Bm55X5ke.css` (92,140 raw bytes, 14,467 gzip at `gzip -9`) to `index-CMAsv2Ey.css` (91,423 raw bytes, 14,398 gzip at `gzip -9`; Vite reports 14.49 kB gzip). The measured transfer size, 14,869 bytes, is under the unchanged 14,875 ceiling — a 6-byte margin, so any new utility would need a deliberate budget review rather than being absorbed silently.

The dev-server report that prompted this work has been deleted and is not cited as evidence.

## 8. Done condition

- The production build scores 1.0 on Lighthouse SEO for `/login` and `/register`, one cold run each, recorded with its `SITE_URL` in §7.6.
- `verify:seo` is green in CI for both public HTML files, `robots.txt`, `sitemap.xml`, and `vercel.json`.
- Raw `dist` HTML contains the full head for both public routes and `noindex` for the catch-all — verifiable without executing JavaScript.
- JS and CSS byte budgets are unchanged and pass; the measured cost of the reconciliation component is recorded.
- The reference dev-server report is deleted and never cited as evidence.
- `GLOSSARY.md`, this document, and ADR-0014 describe the shipped behaviour; link-preview-debugger verification remains recorded as pending a host.
