import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { login, register } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}))

vi.mock("@/utils/auth-client", () => ({ login, register }))

import {
  authProvider,
  getAuthToken,
  getAuthUser,
  resetAuthState,
} from "@/providers/auth-provider"

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthState()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function authBody(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: "mock.access",
    refreshToken: "mock.refresh",
    user: {
      id: "usr_1",
      name: "Ada Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  }
}

describe("authProvider", () => {
  it("login stores the access token in memory and redirects to the dashboard", async () => {
    login.mockResolvedValue({ status: 200, body: authBody() })

    const result = await authProvider.login({
      email: "admin@example.com",
      password: "adminpass",
    })

    expect(login).toHaveBeenCalledWith("admin@example.com", "adminpass")
    expect(result.success).toBe(true)
    expect(result.redirectTo).toBe("/dashboard")
    expect(getAuthToken()).toBe("mock.access")
    expect(getAuthUser()?.role).toBe("admin")
  })

  it("login surfaces invalid credentials as an error", async () => {
    login.mockResolvedValue({
      status: 401,
      body: { code: "invalid_credentials", message: "Incorrect email or password." },
    })

    const result = await authProvider.login({
      email: "admin@example.com",
      password: "wrong",
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(getAuthToken()).toBeNull()
  })

  it("logout clears the in-memory session and redirects to login", async () => {
    login.mockResolvedValue({ status: 200, body: authBody() })
    await authProvider.login({ email: "a@b.c", password: "x" })

    const result = await authProvider.logout(undefined)

    expect(result.success).toBe(true)
    expect(result.redirectTo).toBe("/login")
    expect(getAuthToken()).toBeNull()
    expect(getAuthUser()).toBeNull()
  })

  it("check resolves authenticated when a user is in memory", async () => {
    login.mockResolvedValue({ status: 200, body: authBody() })
    await authProvider.login({ email: "a@b.c", password: "x" })

    const result = await authProvider.check()

    expect(result.authenticated).toBe(true)
    expect(getAuthUser()?.role).toBe("admin")
    expect(getAuthToken()).toBe("mock.access")
  })

  it("check resolves unauthenticated and clears memory without a user", async () => {
    const result = await authProvider.check()

    expect(result.authenticated).toBe(false)
    expect(result.redirectTo).toBe("/login")
    expect(getAuthToken()).toBeNull()
    expect(getAuthUser()).toBeNull()
  })

  it("getIdentity returns the current user from memory", async () => {
    login.mockResolvedValue({ status: 200, body: authBody() })
    await authProvider.login({ email: "a@b.c", password: "x" })

    const identity = await authProvider.getIdentity?.()

    expect(identity).toMatchObject({ id: "usr_1", role: "admin" })
  })

  it("register creates an account and stores the session", async () => {
    register.mockResolvedValue({
      status: 201,
      body: authBody({
        user: {
          id: "usr_2",
          name: "New User",
          email: "new@example.com",
          role: "member",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    })

    const result = await authProvider.register?.({
      name: "New User",
      email: "new@example.com",
      password: "secret",
    })

    expect(register).toHaveBeenCalledWith("New User", "new@example.com", "secret")
    expect(result?.success).toBe(true)
    expect(result?.redirectTo).toBe("/dashboard")
    expect(getAuthUser()?.role).toBe("member")
  })
})
