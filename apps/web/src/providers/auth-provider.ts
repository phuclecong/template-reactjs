import type { AuthActionResponse, AuthProvider } from "@refinedev/core"
import { login, register } from "@/utils/auth-client"
import type { PublicUser } from "@workspace/api/service"

/**
 * Refine authProvider (ADR-0002, ADR-0003). Login/register/logout call the auth
 * transport (real backend when `VITE_API_URL` is set, otherwise the in-process
 * mock) and hold the returned access token in memory, mirrored to sessionStorage
 * so the session survives a reload. There is no server, so there is no signed
 * httpOnly cookie: sessionStorage (not localStorage) keeps the token scoped to
 * the current tab and is cleared when the tab closes.
 */

export interface SessionUser {
  id: string
  name: string
  email: string
  role: "admin" | "member"
}

/** The identity subset the dashboard shell and sidebar render in the footer. */
export type DashboardUser = Pick<SessionUser, "name" | "email" | "role">

const SESSION_KEY = "auth.session"

interface PersistedSession {
  token: string
  user: SessionUser
}

function readPersistedSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedSession>
    if (
      typeof parsed.token === "string" &&
      typeof parsed.user?.id === "string" &&
      typeof parsed.user?.name === "string" &&
      typeof parsed.user?.email === "string" &&
      (parsed.user?.role === "admin" || parsed.user?.role === "member")
    ) {
      return parsed as PersistedSession
    }
    return null
  } catch {
    return null
  }
}

function writePersistedSession(token: string, user: SessionUser): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
  } catch {
    // Storage unavailable (private mode / quota) — keep the in-memory fallback.
  }
}

function clearPersistedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Ignore — the in-memory state is already cleared by the callers.
  }
}

const persisted = readPersistedSession()

let inMemoryToken: string | null = persisted?.token ?? null
let inMemoryUser: SessionUser | null = persisted?.user ?? null

export function getAuthToken(): string | null {
  return inMemoryToken
}

export function getAuthUser(): SessionUser | null {
  return inMemoryUser
}

export function resetAuthState(): void {
  inMemoryToken = null
  inMemoryUser = null
  clearPersistedSession()
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
  writePersistedSession(inMemoryToken, inMemoryUser)
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
    resetAuthState()
    return { success: true, redirectTo: "/login" }
  },

  async check() {
    if (inMemoryUser) return { authenticated: true }
    return { authenticated: false, redirectTo: "/login" }
  },

  async onError(error: unknown) {
    // Only force a logout when the request was rejected as *unauthenticated*.
    // Domain 401s — e.g. a wrong current-password on the password form — carry a
    // different `code` and must not end the session.
    const code = (error as {
      response?: { data?: { code?: unknown } }
    })?.response?.data?.code
    if (code === "unauthorized") return { logout: true, redirectTo: "/login" }
    return { logout: false }
  },

  async getIdentity() {
    return inMemoryUser
  },

  async getPermissions() {
    return inMemoryUser?.role ?? null
  },
}
