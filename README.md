# React monorepo template

A runnable reference dashboard — Users, Tasks, and Settings pages — built on
Refine + React Router 7 + React 19 + Vite + TypeScript + Tailwind/shadcn. The
backend is mocked from a contract-first OpenAPI 3.0 spec via MSW, so the front
end is fully functional today and the spec hands off to FastAPI later. It
demonstrates a reusable component system, role-based access control
(admin/member), i18n (en/vi with currency formatting), a task table with
debounced search, WCAG 2.2 AA accessibility, and a full test harness (Vitest +
Playwright + Storybook).

## Project structure

```bash
├── apps/
│   └── web/                  # Refine + React Router 7 app (Vite SPA)
├── packages/
│   ├── ui/                   # Shared shadcn/ui components + Storybook
│   ├── shared-lib/           # App-agnostic table infra (DataTable, useTableState)
│   ├── api/                  # OpenAPI 3.0 contract + MSW-backed client
│   ├── eslint-config/        # Shared ESLint configs (base, react-internal)
│   └── typescript-config/    # Shared tsconfig presets (base, react-library)
├── docs/
│   ├── adr/                  # Architecture decision records
│   └── deployment.md         # Vercel deployment guide
├── package.json
├── pnpm-workspace.yaml
└── ...
```

## Up and running

1. Install dependencies and start the dev server

```bash
pnpm i
pnpm dev
```

2. Open the app at http://localhost:5174/

3. Log in with a demo account

| Email                | Password     | Role     |
| -------------------- | ------------ | -------- |
| `admin@example.com`  | `adminpass`  | `admin`  |
| `member@example.com` | `memberpass` | `member` |

## Commands

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `pnpm install`      | Install dependencies for all workspaces.    |
| `pnpm dev`          | Start the `apps/web` Vite dev server.       |
| `pnpm build`        | Build `apps/web` for production.            |
| `pnpm lint`         | Run linting across the monorepo.            |
| `pnpm typecheck`    | Run type-checking across the monorepo.      |
| `pnpm test`         | Run Vitest unit tests.                      |
| `pnpm test:e2e`     | Run Playwright end-to-end tests.            |
| `pnpm test:e2eui`   | Run Playwright end-to-end tests in UI mode. |
| `pnpm storybook`    | Start Storybook for `packages/ui`.          |
| `pnpm view-openapi` | View the OpenAPI 3.0 contract.              |

## The app

[`apps/web`](./apps/web/) is the user-facing SPA: an authenticated dashboard
with Tasks, Users, and Settings pages. See
[`apps/web/README.md`](./apps/web/README.md) for its layout, routing, auth,
i18n, and command reference.

## Design system

[`packages/ui`](./packages/ui/) holds domain-agnostic primitives (Button,
Dialog, Field, Sidebar, Table, …) built on Base UI + Tailwind, with Storybook.
See [`packages/ui/README.md`](./packages/ui/README.md).

## Mock API

[`packages/api`](./packages/api/) is the contract-first mock API layer:
`openapi.yaml` is the source of truth, compiled to MSW handlers and generated
TypeScript types. See [`packages/api/README.md`](./packages/api/README.md).

## Deployment

See [`docs/deployment.md`](./docs/deployment.md).

## Skills

See [`docs/skills.md`](./docs/skills.md) for the `create-table`, `create-form`,
and `create-dialog` skills.
