# Deployment

This repository is a Turborepo monorepo whose deployable unit is the `apps/web`
React (Vite) SPA (with `@workspace/ui`, `@workspace/api`, and
`@workspace/shared-lib` as workspace packages).

> **Status:** no production environment is provisioned in this repository, and
> none is created by the tooling. This document describes how to deploy
> `apps/web` to [Vercel](https://vercel.com) when a host is set up. CI (see
> [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs lint,
> typecheck, test, and build on every PR, but does **not** deploy.

## Target

Deploy only `apps/web` as a static SPA. Vite emits a `dist/` directory of
static assets. Configure the project with:

- **Root directory:** `apps/web`
- **Build command:** `pnpm --filter web build` (runs `tsc -b && vite build`)
- **Output directory:** `dist`

The build emits one HTML document per public route (`login.html`,
`register.html`) plus a catch-all `index.html` for the dashboard and unknown
paths. `apps/web/vercel.json` resolves the public routes first and falls back to
the catch-all:

```json
{
  "rewrites": [
    { "source": "/login", "destination": "/login.html" },
    { "source": "/register", "destination": "/register.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Environment variables

| Variable       | Required       | Purpose                                                                                                                                                                                                                                         |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`     | **yes (live)** | Canonical origin for the deployment (for example `https://app.example.com`), used for canonical, `og:url`, `og:image`, JSON-LD, sitemap, and robots URLs. Build-time only; it is never shipped to the browser. When unset, the build warns and uses `http://localhost:4173`. |
| `VITE_API_URL` | optional       | Real backend origin (including the `/api` prefix). When set, the app calls it directly (CORS must be enabled on the backend); when unset, the in-browser MSW mock serves the API.                                                               |

**A live host must set `SITE_URL`.** Without it, the emitted canonical and
social URLs point at `http://localhost:4173`, which is correct for local
preview but wrong for anything reachable by crawlers or link-preview tools.

## Steps

1. Import the repository into Vercel.
2. Set **Root Directory** to `apps/web`.
3. Set `SITE_URL` to the deployment's canonical origin.
4. (Optional) Add `VITE_API_URL` to point at a real backend; omit it to keep the
   in-browser mock.
5. Deploy — the route rewrites in `vercel.json` are already committed.

## Mock mode vs. real backend

- **Mock mode** (`VITE_API_URL` unset): the browser runs an MSW worker that
  intercepts `/api/*`, and auth calls `@workspace/api` in-process. Nothing
  external is needed.
- **Real backend** (`VITE_API_URL` set): the app calls the backend origin
  directly, so the backend must allow the app's origin via CORS (see the
  FastAPI backend's `CORS_ORIGINS` setting). Since a static host cannot run a
  server or a dev proxy in production, CORS is required for real-backend mode.
