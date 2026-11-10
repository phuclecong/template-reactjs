import type { AuthActionResponse, AuthProvider } from "@refinedev/core"
import { login, register } from "@/utils/auth-client"
import type { PublicUser } from "@workspace/api/service"

/**
 * Refine authProvider (ADR-0002, ADR-0003). Login/register/logout call the auth
 * transport (real backend when `VITE_API_URL` is set, otherwise the in-process
 * mock) and hold the returned access token in memory only — never localStorage.
 * There is no server, so there is no signed httpOnly cookie: `check`/
 * `getIdentity` read the in-memory token, and reloading the app drops it.
 */

export interface SessionUser {
  id: string
  name: string
  email: string
  role: "admin" | "member"
}

/** The identity subset the dashboard shell and sidebar render in the footer. */
export type DashboardUser = Pick<SessionUser, "name" | "email" | "role">

let inMemoryToken: string | null = null
let inMemoryUser: SessionUser | null = null

export function getAuthToken(): string | null {
  return inMemoryToken
}

export function getAuthUser(): SessionUser | null {
  return inMemoryUser
}

export function resetAuthState(): void {
  inMemoryToken = null
  inMemoryUser = null
}

export async function ensureAuthUser(): Promise<SessionUser | null> {
  return inMemoryUser
}

function isAuthResponse(body: unknown): body is {
  accessToken: string
  user: PublicUser
} {
  if (typeof body !== "object" || body === null) return false
  const candidate = body as Record<string, unknown>
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.user === "object" &&
    candidate.user !== null
  )
}

function toSessionUser(user: PublicUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

function toAuthResult(
  result: { status: number; body: unknown },
  errorMessage: string
): AuthActionResponse {
  if (result.status >= 400 || !isAuthResponse(result.body)) {
    return { success: false, error: new Error(errorMessage) }
  }
  inMemoryToken = result.body.accessToken
  inMemoryUser = toSessionUser(result.body.user)
  return { success: true, redirectTo: "/dashboard" }
}

export const authProvider: AuthProvider = {
  async login(params: { email?: string; password?: string }) {
    const result = await login(params.email ?? "", params.password ?? "")
    return toAuthResult(result, "Invalid email or password.")
  },

  async register(params: { name?: string; email?: string; password?: string }) {
    const result = await register(
      params.name ?? "",
      params.email ?? "",
      params.password ?? ""
    )
    if (result.status === 409) {
      return {
        success: false,
        error: new Error("An account with this email already exists."),
      }
    }
    return toAuthResult(result, "Please fill in name, email and password.")
  },

  async logout() {
    inMemoryToken = null
    inMemoryUser = null
    return { success: true, redirectTo: "/login" }
  },

  async check() {
    if (inMemoryUser) return { authenticated: true }
    return { authenticated: false, redirectTo: "/login" }
  },

  async onError() {
    return { logout: true, redirectTo: "/login" }
  },

  async getIdentity() {
    return inMemoryUser
  },

  async getPermissions() {
    return inMemoryUser?.role ?? null
  },
}
