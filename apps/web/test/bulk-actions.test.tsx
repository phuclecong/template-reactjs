// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { Refine, type DataProvider } from "@refinedev/core"
import { QueryClient } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { useBulkActions } from "@workspace/shared-lib/hooks"
import type { BulkActionConfig } from "@workspace/shared-lib/hooks"

type Row = { id: string; title: string }
type BulkResult = {
  updated?: number
  deleted?: number
  failed?: { id: string; reason: string }[]
}

type CustomCall = {
  url: string
  method: string
  payload: Record<string, unknown>
}

type NotificationRecord = {
  message?: string
  description?: string
  type?: string
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeDataProvider(
  calls: CustomCall[],
  respond: (call: CustomCall) => Promise<{ data: BulkResult }>
): DataProvider {
  return {
    custom: async ({
      url,
      method,
      payload,
    }: {
      url: string
      method: string
      payload: Record<string, unknown>
    }) => {
      const call = { url, method, payload }
      calls.push(call)
      return respond(call)
    },
    getList: async () => ({ data: [], total: 0 }),
    getOne: async () => ({ data: {} }),
    create: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
    deleteOne: async () => ({ data: {} }),
    getApiUrl: () => "/api",
  } as unknown as DataProvider
}

function setup(
  respond: (call: CustomCall) => Promise<{ data: BulkResult }> = () =>
    Promise.resolve({ data: { updated: 2, failed: [] } })
) {
  const calls: CustomCall[] = []
  const notifications: NotificationRecord[] = []
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const dataProvider = makeDataProvider(calls, respond)

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <Refine
          dataProvider={dataProvider}
          notificationProvider={{
            open: (notification) => {
              notifications.push(notification as NotificationRecord)
            },
          }}
          resources={[{ name: "roles" }, { name: "tasks" }]}
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

  return { calls, notifications, queryClient, invalidateSpy, Wrapper }
}

const SELECTED: Row[] = [
  { id: "role_1", title: "Alpha" },
  { id: "role_2", title: "Beta" },
]

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("update lifecycle", () => {
  it("guards, patches with the default payload, notifies, tracks, clears, and invalidates", async () => {
    const { calls, notifications, invalidateSpy, Wrapper } = setup()
    const track = vi.fn()
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found", "referenced", "system_role", "validation"] as const,
      track,
      describeError: () => "Request failed",
      onDone,
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => result.current.bulkUpdate({ status: "inactive" }, { onSettled }))

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())

    expect(calls).toEqual([
      {
        url: "/api/roles/bulk",
        method: "patch",
        payload: { ids: ["role_1", "role_2"], status: "inactive" },
      },
    ])
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      type: "success",
      message: "Roles updated: 2",
    })
    expect(track).toHaveBeenCalledWith("role.bulk_action", {
      action: "update",
      selected: 2,
      updated: 2,
      failed: 0,
    })
    expect(onDone).toHaveBeenCalledOnce()
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledOnce())
    expect(invalidateSpy.mock.calls[0]?.[0]).toMatchObject({
      queryKey: expect.arrayContaining(["roles", "list"]),
    })

    // The contract orders analytics before selection clearing, then invalidation.
    expect(track.mock.invocationCallOrder[0]).toBeLessThan(
      onDone.mock.invocationCallOrder[0]!
    )
    expect(onDone.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateSpy.mock.invocationCallOrder[0]!
    )
    expect(result.current.isApplying).toBe(false)
  })
})

describe("failure reporting", () => {
  it("translates known reasons, prints unknown reasons raw, and falls back to the id for missing titles", async () => {
    const { notifications, Wrapper } = setup(() =>
      Promise.resolve({
        data: {
          updated: 1,
          failed: [
            { id: "role_2", reason: "system_role" },
            { id: "role_1", reason: "mystery" },
            { id: "ghost", reason: "not_found" },
          ],
        },
      })
    )
    const track = vi.fn()
    const onDone = vi.fn()
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found", "referenced", "system_role", "validation"] as const,
      track,
      describeError: () => "Request failed",
      onDone,
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => result.current.bulkUpdate({ status: "inactive" }))

    await waitFor(() => expect(notifications).toHaveLength(1))
    expect(notifications[0]).toMatchObject({
      type: "error",
      message: "Roles updated: 1 · failed: 3",
      description: "Beta: system role; Alpha: mystery; ghost: not found",
    })
    expect(track).toHaveBeenCalledWith("role.bulk_action", {
      action: "update",
      selected: 2,
      updated: 1,
      failed: 3,
    })
    expect(onDone).toHaveBeenCalledOnce()
  })
})

describe("parameterization", () => {
  it("honours custom update values, method, and analytics trackData", async () => {
    const { calls, Wrapper } = setup(() =>
      Promise.resolve({ data: { updated: 1, failed: [] } })
    )
    const track = vi.fn()
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found"] as const,
      track,
      describeError: () => "Request failed",
      onDone: vi.fn(),
      update: {
        url: "/api/things/bulk",
        method: "put" as const,
        values: (ids: string[], patch: { priority?: string }) => ({
          targets: ids,
          changes: patch,
        }),
        trackData: (patch: { priority?: string }) => ({
          fields: Object.keys(patch),
        }),
      },
      delete: { url: "/api/things/bulk-delete" },
    } satisfies BulkActionConfig<Row, { priority?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { priority?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => result.current.bulkUpdate({ priority: "high" }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({
      url: "/api/things/bulk",
      method: "put",
      payload: {
        targets: ["role_1", "role_2"],
        changes: { priority: "high" },
      },
    })
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("role.bulk_action", {
        action: "update",
        fields: ["priority"],
        selected: 2,
        updated: 1,
        failed: 0,
      })
    )
  })
})

describe("delete lifecycle", () => {
  it("deletes with the default post payload, notifies, tracks, clears, and invalidates", async () => {
    const { calls, notifications, invalidateSpy, Wrapper } = setup(() =>
      Promise.resolve({ data: { deleted: 2, failed: [] } })
    )
    const track = vi.fn()
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found", "system_role"] as const,
      track,
      describeError: () => "Request failed",
      onDone,
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    // A delete-capable config exposes a required handler.
    act(() => result.current.bulkDelete({ onSettled }))

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())
    expect(calls).toEqual([
      {
        url: "/api/roles/bulk-delete",
        method: "post",
        payload: { ids: ["role_1", "role_2"] },
      },
    ])
    expect(notifications[0]).toMatchObject({
      type: "success",
      message: "Roles deleted: 2",
    })
    expect(track).toHaveBeenCalledWith("role.bulk_action", {
      action: "delete",
      selected: 2,
      deleted: 2,
      failed: 0,
    })
    expect(onDone).toHaveBeenCalledOnce()
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledOnce())
    expect(invalidateSpy.mock.calls[0]?.[0]).toMatchObject({
      queryKey: expect.arrayContaining(["roles", "list"]),
    })
  })

  it("reports delete partial failures and honours custom values and method", async () => {
    const { calls, notifications, Wrapper } = setup(() =>
      Promise.resolve({
        data: {
          deleted: 1,
          failed: [{ id: "role_2", reason: "referenced" }],
        },
      })
    )
    const track = vi.fn()
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found", "referenced", "system_role", "validation"] as const,
      track,
      describeError: () => "Request failed",
      onDone: vi.fn(),
      update: { url: "/api/roles/bulk" },
      delete: {
        url: "/api/roles/remove",
        method: "delete" as const,
        values: (ids: string[]) => ({ roleIds: ids }),
      },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => result.current.bulkDelete())

    await waitFor(() => expect(notifications).toHaveLength(1))
    expect(calls).toEqual([
      {
        url: "/api/roles/remove",
        method: "delete",
        payload: { roleIds: ["role_1", "role_2"] },
      },
    ])
    expect(notifications[0]).toMatchObject({
      type: "error",
      message: "Roles deleted: 1 · failed: 1",
      description: "Beta: assigned to a user",
    })
    expect(track).toHaveBeenCalledWith("role.bulk_action", {
      action: "delete",
      selected: 2,
      deleted: 1,
      failed: 1,
    })
  })
})

describe("error and guard behaviour", () => {
  it("uses the injected describeError and skips success work on transport errors", async () => {
    const { calls, notifications, Wrapper } = setup(() =>
      Promise.reject(new Error("Network down"))
    )
    const track = vi.fn()
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const describeError = vi.fn(() => "Conflict: role is assigned")
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found"] as const,
      track,
      describeError,
      onDone,
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => result.current.bulkUpdate({ status: "inactive" }, { onSettled }))

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())
    expect(calls).toHaveLength(1)
    expect(describeError).toHaveBeenCalledOnce()
    expect(notifications[0]).toMatchObject({
      type: "error",
      message: "Bulk action failed",
      description: "Conflict: role is assigned",
    })
    expect(track).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it("does nothing when the selection is empty", async () => {
    const { calls, notifications, Wrapper } = setup()
    const track = vi.fn()
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const config = {
      selected: [] as Row[],
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found"] as const,
      track,
      describeError: () => undefined,
      onDone,
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => {
      result.current.bulkUpdate({ status: "inactive" }, { onSettled })
      result.current.bulkDelete({ onSettled })
    })

    expect(calls).toHaveLength(0)
    expect(notifications).toHaveLength(0)
    expect(track).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
  })

  it("reports isApplying while the update is pending", async () => {
    const gate = deferred<{ data: BulkResult }>()
    const { Wrapper } = setup(() => gate.promise)
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found"] as const,
      track: vi.fn(),
      describeError: () => undefined,
      onDone: vi.fn(),
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )
    expect(result.current.isApplying).toBe(false)

    act(() => result.current.bulkUpdate({ status: "inactive" }))
    await waitFor(() => expect(result.current.isApplying).toBe(true))

    await act(async () => gate.resolve({ data: { updated: 2, failed: [] } }))
    await waitFor(() => expect(result.current.isApplying).toBe(false))
  })

  it("ORs a pending delete into isApplying for delete-capable configs", async () => {
    const gate = deferred<{ data: BulkResult }>()
    const { Wrapper } = setup(() => gate.promise)
    const config = {
      selected: SELECTED,
      resource: "roles",
      event: "role.bulk_action",
      keyPrefix: "roles.bulk",
      reasons: ["not_found"] as const,
      track: vi.fn(),
      describeError: () => undefined,
      onDone: vi.fn(),
      update: { url: "/api/roles/bulk" },
      delete: { url: "/api/roles/bulk-delete" },
    } satisfies BulkActionConfig<Row, { status?: string }>

    const { result } = renderHook(
      () => useBulkActions<Row, { status?: string }>(config),
      { wrapper: Wrapper }
    )

    act(() => result.current.bulkDelete())
    await waitFor(() => expect(result.current.isApplying).toBe(true))

    await act(async () => gate.resolve({ data: { deleted: 2, failed: [] } }))
    await waitFor(() => expect(result.current.isApplying).toBe(false))
  })
})

describe("real feature configuration", () => {
  it("renders the shipped Tasks copy and exposes no delete action", async () => {
    const { notifications, Wrapper } = setup(() =>
      Promise.resolve({
        data: {
          updated: 1,
          failed: [{ id: "task_2", reason: "forbidden" }],
        },
      })
    )
    const track = vi.fn()
    const config = {
      selected: [
        { id: "task_1", title: "Write brief" },
        { id: "task_2", title: "Review brief" },
      ],
      resource: "tasks",
      event: "task.bulk_action",
      keyPrefix: "tasks.bulk",
      reasons: ["not_found", "forbidden"] as const,
      track,
      describeError: () => undefined,
      onDone: vi.fn(),
      update: {
        url: "/api/tasks/bulk",
        trackData: (patch: { status?: string }) => ({
          fields: Object.keys(patch),
        }),
      },
    } satisfies BulkActionConfig<{ id: string; title: string }, { status?: string }>

    const { result } = renderHook(
      () =>
        useBulkActions<{ id: string; title: string }, { status?: string }>(
          config
        ),
      { wrapper: Wrapper }
    )

    expect(result.current.bulkDelete).toBeUndefined()

    act(() => result.current.bulkUpdate({ status: "done" }))

    await waitFor(() => expect(notifications).toHaveLength(1))
    expect(notifications[0]).toMatchObject({
      type: "error",
      message: "Updated 1 tasks, 1 failed",
      description: "Review brief: not permitted",
    })
    expect(track).toHaveBeenCalledWith("task.bulk_action", {
      action: "update",
      fields: ["status"],
      selected: 2,
      updated: 1,
      failed: 1,
    })
  })
})
