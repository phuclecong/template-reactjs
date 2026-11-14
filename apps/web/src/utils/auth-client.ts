import type { ServiceResult } from "@workspace/api/service"
import { apiUrl } from "@/utils/api-url"
import { ensureMockWorker } from "@/utils/mock-worker"

async function post(path: string, body: unknown): Promise<ServiceResult> {
  try {
    // Start the mock worker on the first auth request too. Login uses native
    // `fetch`, not the axios data provider, so a loader wired only into axios
    // would let the request hit the SPA fallback and surface as a misleading
    // "Invalid email or password." when the response is HTML.
    await ensureMockWorker()
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const data: unknown = await response.json().catch(() => null)
    return { status: response.status, body: data }
  } catch {
    return {
      status: 502,
      body: { code: "upstream_error", message: "Auth API is unreachable." },
    }
  }
}

export async function login(
  email: string,
  password: string
): Promise<ServiceResult> {
  return post("/auth/login", { email, password })
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<ServiceResult> {
  return post("/auth/register", { name, email, password })
}
