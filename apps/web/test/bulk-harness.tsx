import type { ReactNode } from "react"
import { QueryClient } from "@tanstack/react-query"
import { Refine, type DataProvider } from "@refinedev/core"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"

import i18n from "@/utils/i18n"

export type BulkCustomCall = {
  url: string
  method: string
  payload: Record<string, unknown>
}

export type BulkResult = {
  updated?: number
  deleted?: number
  failed?: { id: string; reason: string }[]
}

export type BulkNotification = {
  message?: string
  description?: string
  type?: string
}

export type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export type BulkHarnessOptions = {
  resources: { name: string }[]
  /** Resolves the payload the stub data provider returns. */
  respond: (call: BulkCustomCall) => Promise<{ data: unknown }>
  /** Tasks' hook runs under a router; Roles' does not. */
  withRouter?: boolean
}

/**
 * Shared Refine + notification harness for the bulk-action tests. The test owns
 * the QueryClient through this helper so invalidation stays observable; custom
 * calls and notifications are recorded for assertions.
 */
export function createBulkHarness({
  resources,
  respond,
  withRouter = false,
}: BulkHarnessOptions) {
  const calls: BulkCustomCall[] = []
  const notifications: BulkNotification[] = []

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

  const customMock = vi.fn((params: BulkCustomCall) => {
    const call = {
      url: params.url,
      method: params.method,
      payload: params.payload,
    }
    calls.push(call)
    return respond(call)
  })
  const openMock = vi.fn((notification: BulkNotification) => {
    notifications.push(notification)
  })

  const dataProvider = {
    custom: customMock,
    // `getList` marks this as a single (not named) provider; without it
    // Refine's data context does not install it as `default`.
    getList: async () => ({ data: [], total: 0 }),
    getOne: async () => ({ data: {} }),
    create: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
    deleteOne: async () => ({ data: {} }),
    getApiUrl: () => "/api",
  } as unknown as DataProvider

  function Content({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <Refine
          dataProvider={dataProvider}
          notificationProvider={{
            open: (params) => openMock(params as BulkNotification),
            close: () => {},
          }}
          resources={resources}
          options={{
            syncWithLocation: false,
            disableTelemetry: true,
            reactQuery: { clientConfig: queryClient },
          }}
        >
          {children}
        </Refine>
      </I18nextProvider>
    )
  }

  function Wrapper({ children }: { children: ReactNode }) {
    const content = <Content>{children}</Content>
    return withRouter ? <MemoryRouter>{content}</MemoryRouter> : content
  }

  return {
    calls,
    customMock,
    notifications,
    openMock,
    queryClient,
    invalidateSpy,
    dataProvider,
    Wrapper,
  }
}
