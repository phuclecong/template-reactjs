# Client-side i18n without a URL locale prefix

Locale is resolved client-side via Refine's `i18nProvider` (i18next) and persisted to a cookie + localStorage; URLs carry no locale segment. A `[lang]` URL segment is deliberately avoided because the app is an authenticated, client-side dashboard with minimal SEO, and a `[lang]` segment would fight Refine's client routing.
