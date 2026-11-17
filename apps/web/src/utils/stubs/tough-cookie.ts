/**
 * Browser-build stub for `tough-cookie`.
 *
 * MSW bundles a cookie jar (`tough-cookie` -> `tldts`) into every browser
 * build, even though this app's mock API never reads or writes cookies: auth
 * uses an in-memory bearer token mirrored to `sessionStorage`, never a cookie.
 * That unused jar accounts for the majority of the `msw-*.js` chunk (~250 kB
 * of `tldts` alone), so `vite.config.ts` aliases the package to this inert
 * implementation.
 *
 * The mock handlers do not call `request.cookies` and never return
 * `Set-Cookie`, so an empty jar is behaviourally equivalent here. Keep it in
 * sync with MSW's cookie store if MSW starts relying on more of the API.
 */

export class Cookie {
  key = ""
  value = ""
  domain: string | null = null
  path: string | null = null

  static fromJSON(raw: unknown): Cookie | null {
    void raw
    return null
  }

  toJSON(): Record<string, unknown> {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Record<string, Record<string, Record<string, Cookie>>> = {}
}

export class CookieJar {
  readonly store: MemoryCookieStore

  constructor(store: MemoryCookieStore) {
    this.store = store
  }

  getCookiesSync(url: string): Cookie[] {
    void url
    return []
  }

  async setCookie(cookie: string, url: string): Promise<void> {
    void cookie
    void url
  }
}
