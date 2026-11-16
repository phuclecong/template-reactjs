const STORAGE_KEY = "observability.session"

/**
 * Resolved once per page lifetime: from session storage when possible, or
 * module memory when storage is unavailable. It is anonymous by construction:
 * never derived from auth state.
 */
let cachedSessionId: string | undefined

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Returns the Analytics session id for this tab, creating and persisting it on
 * first use. A reload keeps the id; a new tab gets a new one. If storage access
 * throws, the id lives in module memory for the page lifetime.
 */
export function getAnalyticsSessionId(): string {
  if (cachedSessionId !== undefined) return cachedSessionId

  try {
    const existing = sessionStorage.getItem(STORAGE_KEY)
    if (existing) {
      cachedSessionId = existing
      return existing
    }

    cachedSessionId = createSessionId()
    sessionStorage.setItem(STORAGE_KEY, cachedSessionId)
    return cachedSessionId
  } catch {
    cachedSessionId ??= createSessionId()
    return cachedSessionId
  }
}
