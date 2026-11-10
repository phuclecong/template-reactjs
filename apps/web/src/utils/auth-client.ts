import {
  loginUser,
  registerUser,
  type ServiceResult,
} from "@workspace/api/service"

/**
 * Auth transport (ADR-0003). With `VITE_API_URL` set it calls the real backend
 * over HTTP through the dev proxy / production rewrite (`/api/*`); otherwise it
 * falls back to the in-process mock. Both paths return the same
 * `{ status, body }` shape — the OpenAPI contract's `AuthResponse`/`Error`.
 */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined

async function post(path: string, body: unknown): Promise<ServiceResult> {
  try {
    const response = await fetch(path, {
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
  if (!apiUrl) return loginUser(email, password)
  return post("/api/auth/login", { email, password })
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<ServiceResult> {
  if (!apiUrl) return registerUser(name, email, password)
  return post("/api/auth/register", { name, email, password })
}
