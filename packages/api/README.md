# `@workspace/api`

Contract-first mock API layer for the template monorepo.

## Purpose

`openapi.yaml` is the single source of truth for the dashboard's API. This package turns that contract into three artifacts:

1. **MSW handlers** — a stateful mock backend (in-memory via `@msw/data`) that serves the API in the browser and in Node smoke tests.
2. **TypeScript types** — client types generated into `src/generated/api.d.ts` via `openapi-typescript`.
3. **Framework-free business logic** — the auth/service layer shared by the mock handlers and the client auth provider.

## Structure

```txt
packages/api/
├── openapi.yaml               # Single source of truth for the API contract
├── src/
│   ├── index.ts               # Public entry point (re-exports)
│   ├── service.ts             # Framework-free auth business logic
│   ├── handlers.ts            # Spec-derived + data-backed handlers (Node)
│   ├── data-handlers.ts       # Stateful, hand-written MSW handlers (browser-safe)
│   ├── dashboard.ts           # Pure Task-summary aggregation
│   ├── live-events.ts         # Browser- and Node-safe Live event bus
│   ├── live-handlers.ts       # MSW SSE handler + mock activity loop (browser-only)
│   ├── collections.ts         # Zod schemas + @msw/data collections + seeding
│   ├── policy.ts              # Browser-safe System Role ids and predicates
│   ├── system-roles.json      # System Role ids shared with non-TS tooling
│   ├── auth.ts                # Mock bearer token sign/verify
│   └── generated/api.d.ts     # Generated client types (from openapi.yaml)
├── test/
│   ├── smoke.test.ts          # End-to-end API smoke tests (MSW node server)
│   └── types.test.ts          # Compile-time checks of the generated types
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Usage

### In the browser (mock worker)

`data-handlers` is browser-safe — no `node:fs`, no `fromOpenApi`, no top-level `await` — so it can be bundled into the MSW worker:

```ts
import { setupWorker } from "msw/browser"
import { dataHandlers } from "@workspace/api/data-handlers"
import { createLiveHandlers } from "@workspace/api/live-handlers"
import { resetDb } from "@workspace/api/collections"

await resetDb()
const worker = setupWorker(
  ...dataHandlers,
  // `sse()` requires a global EventSource, so create it in the browser only.
  ...createLiveHandlers({ simulateActivity: true })
)
await worker.start()
```

`createLiveHandlers` serves `GET /api/events?channel=resources/tasks&access_token=…`
with MSW 3's `sse()`. Task mutations publish ids on the `live-events` bus; the
handler forwards them as `live` frames. `simulateActivity` toggles a rotating
seeded Task every 10 s while a client is connected and must stay off in Node
tests (it is not part of `dataHandlers`).

### In Node (smoke tests)

`handlers` composes the data-backed handlers with a spec-generated fallback:

```ts
import { setupServer } from "msw/node"
import { handlers, resetDb } from "@workspace/api"

const server = setupServer(...handlers)
server.listen()
await resetDb()
```

### Shared business logic

`service` is framework-free — no MSW, no `Request`/`Response`, no top-level `await` — so it can run in the browser and in Node smoke tests:

```ts
import {
  loginUser,
  registerUser,
  getUserByAccessToken,
} from "@workspace/api/service"

const result = await loginUser("member@example.com", "memberpass")
// { status: 200, body: { accessToken, refreshToken, user } }
```

### Role policy

`policy` is browser-safe and dependency-free, so the API guards and the client
gate on the same System Role rules:

```ts
import {
  ADMIN_ROLE_ID,
  SYSTEM_ROLE_IDS,
  isAdministratorRole,
  isSystemRole,
} from "@workspace/api/policy"

isAdministratorRole(ADMIN_ROLE_ID) // true
isSystemRole("rol_demo_01") // false
```

The role ids live in `src/system-roles.json` so non-TypeScript tooling (for
example the Lighthouse login script) reads the same values.

### Shared types and schemas

```ts
import type { Role } from "@workspace/api/collections"
import {
  taskPrioritySchema,
  taskStatusSchema,
} from "@workspace/api/collections"
import type { AuthResponseBody, PublicUser } from "@workspace/api/service"
```

## Demo accounts

The store seeds two accounts (`ensureSeedUsers` / `seedDb`):

| Email                | Password     | Role     |
| -------------------- | ------------ | -------- |
| `admin@example.com`  | `adminpass`  | `admin`  |
| `member@example.com` | `memberpass` | `member` |

Tokens are mock bearer tokens (prefixed `mock.`) that round-trip the user id and role. They are **not** cryptographically signed — the FastAPI backend issues real JWTs.

## API surface

All routes are under `/api` and use bearer auth unless noted.

| Method | Path              | Auth           | Description                                    |
| ------ | ----------------- | -------------- | ---------------------------------------------- |
| POST   | `/auth/register`  | —              | Register; `201`, `409` on duplicate email      |
| POST   | `/auth/login`     | —              | Log in with email + password                   |
| POST   | `/auth/refresh`   | —              | Exchange a refresh token for an access token   |
| POST   | `/auth/logout`    | bearer         | `204`                                          |
| GET    | `/users`          | bearer         | List users (passwords stripped)                |
| PATCH  | `/users/:id/role` | admin          | Change a user's role                           |
| DELETE | `/users/:id`      | admin          | Delete a user                                  |
| GET    | `/tasks`          | bearer         | List tasks with filters, sort, and pagination  |
| POST   | `/tasks`          | bearer         | Create a task (assigned to the caller)         |
| PATCH  | `/tasks/bulk`     | bearer         | Update several tasks; per-id failures reported |
| PATCH  | `/tasks/:id`      | owner or admin | Update a task                                  |
| DELETE | `/tasks/:id`      | owner or admin | Delete a task                                  |
| PUT    | `/password`       | bearer         | Change the caller's password                   |

`GET /tasks` accepts `q`, `status`, `priority`, `assigneeId` (or the literal `"unassigned"`), `dueDate_gte`, `dueDate_lte`, `_start`, `_end`, `_sort`, and `_order`. Sortable fields are `title`, `status`, `priority`, and `dueDate`. Responses include an `x-total-count` header.

## Scripts

```bash
pnpm --filter @workspace/api generate:types  # regenerate src/generated/api.d.ts
pnpm --filter @workspace/api view-openapi   # open the spec in Swagger UI (or pnpm run view-openapi from the repo root)
pnpm --filter @workspace/api lint
pnpm --filter @workspace/api format
pnpm --filter @workspace/api typecheck
pnpm --filter @workspace/api test
```

## Conventions

- `openapi.yaml` is the single source of truth. After editing it, regenerate the types with `generate:types`.
- Keep `data-handlers.ts` free of `node:fs`, `fromOpenApi`, and top-level `await` so it bundles for the browser.
- Keep `service.ts` framework-free (no MSW, no `Request`/`Response`) so it runs in the browser and in Node.
- Put business logic in `service.ts`; handlers only translate HTTP ↔ service results.
- Record schemas live in `collections.ts` (Zod) alongside the `@msw/data` collections.
- Only the `exports` map in `package.json` is public API; import those subpaths rather than deep files.
