import {
  loginUser,
  registerUser,
  type ServiceResult,
} from "@workspace/api/service"
import { apiUrl } from "@/utils/api-url"

async function post(path: string, body: unknown): Promise<ServiceResult> {
  try {
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
  if (!apiUrl) return loginUser(email, password)
  return post("/auth/login", { email, password })
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<ServiceResult> {
  if (!apiUrl) return registerUser(name, email, password)
  return post("/auth/register", { name, email, password })
}
