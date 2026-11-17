import simpleRestDataProvider from "@refinedev/simple-rest"
// `simple-rest` types its transport as an axios instance. The fetch client
// implements the subset the provider calls (get/post/put/patch/delete with
// `{ data, headers }`), so the cast is type-only — axios is not bundled.
import type { AxiosInstance } from "axios"
import { apiUrl } from "@/utils/api-url"
import { httpClient } from "@/utils/http-client"

/**
 * Refine dataProvider (ADR-0002, ADR-0005). The base URL resolves via
 * `@/utils/api-url` — the real backend when `VITE_API_URL` is set, otherwise
 * the `/api` path served by the in-browser MSW worker. `httpClient` starts the
 * worker on the first request and attaches the in-memory access token, so the
 * backend resolves the caller.
 */
export const dataProvider = simpleRestDataProvider(
  apiUrl,
  httpClient as unknown as AxiosInstance
)
