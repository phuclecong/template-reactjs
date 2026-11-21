import { ensureMockWorker } from "@/utils/mock-worker"
import { getAuthToken } from "@/providers/auth-provider"

/**
 * Minimal fetch client for the Refine `simple-rest` data provider.
 *
 * The provider needs an axios-shaped client (`get`/`post`/`patch`/`put`/
 * `delete` returning `{ data, headers }`, rejecting non-2xx responses with
 * `error.response`), but not axios itself: `axios` was the single largest
 * third-party module in the entry chunk after React. This client provides the
 * same surface on top of the native `fetch` the auth transport already uses,
 * and owns the two behaviours the old axios interceptor provided: start the
 * mock worker before the first request and attach the bearer token.
 */

export interface HttpResponse<T = unknown> {
  data: T
  status: number
  headers: Record<string, string>
}

export interface RequestConfig {
  headers?: Record<string, string>
  data?: unknown
  signal?: AbortSignal
}

/** Rejection shape Refine and the auth provider expect (`error.response`). */
export class HttpError extends Error {
  readonly statusCode: number
  readonly response: {
    status: number
    data: unknown
    headers: Record<string, string>
  }

  constructor(
    status: number,
    data: unknown,
    headers: Record<string, string>
  ) {
    // Match the message `simple-rest`'s former axios interceptor surfaced:
    // the API's own `message` when present, otherwise a generic status line.
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `Request failed with status code ${status}`
    super(message)
    this.name = "HttpError"
    this.statusCode = status
    this.response = { status, data, headers }
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null)
  }
  return response.text()
}

async function request(
  method: string,
  url: string,
  config: RequestConfig = {}
): Promise<HttpResponse> {
  // The mock backend is started on the first request, never at startup
  // (ADR-0005, ADR-0010). This is a no-op against a real backend.
  await ensureMockWorker()

  const headers: Record<string, string> = { ...config.headers }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (config.data !== undefined) {
    if (typeof config.data === "string") {
      body = config.data
    } else {
      headers["content-type"] ??= "application/json"
      body = JSON.stringify(config.data)
    }
  }

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body,
    signal: config.signal,
  })

  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value
  })

  const data = await parseBody(response)
  if (!response.ok) {
    throw new HttpError(response.status, data, responseHeaders)
  }

  return { data, status: response.status, headers: responseHeaders }
}

export const httpClient = {
  get: (url: string, config?: RequestConfig) => request("get", url, config),
  delete: (url: string, config?: RequestConfig) =>
    request("delete", url, config),
  post: (url: string, data?: unknown, config?: RequestConfig) =>
    request("post", url, { ...config, data }),
  put: (url: string, data?: unknown, config?: RequestConfig) =>
    request("put", url, { ...config, data }),
  patch: (url: string, data?: unknown, config?: RequestConfig) =>
    request("patch", url, { ...config, data }),
}
