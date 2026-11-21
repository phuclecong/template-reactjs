// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { track } from "@/observability"
import { useRolesBulkActions } from "@/features/roles/hooks/use-roles-bulk-actions"
import {
  createBulkHarness,
  deferred,
  type BulkCustomCall,
} from "./bulk-harness"

vi.mock("@/observability", () => ({ track: vi.fn() }))

const trackMock = vi.mocked(track)

type SelectedRole = { id: string; title: string }

type HarnessOptions = {
  selected: SelectedRole[]
  onDone?: () => void
  /** Resolves the payload the stub data provider returns. */
  custom?: (call: BulkCustomCall) => Promise<{ data: unknown }>
}

const ROLES: SelectedRole[] = [
  { id: "rol_admin", title: "Administrator" },
  { id: "rol_member", title: "Member" },
]

function renderBulkActions({
  selected,
  onDone = () => {},
  custom = async () => ({ data: { updated: 2, failed: [] } }),
}: HarnessOptions) {
  const harness = createBulkHarness({
    resources: [{ name: "roles" }],
    respond: custom,
  })
  const view = renderHook(() => useRolesBulkActions({ selected, onDone }), {
    wrapper: harness.Wrapper,
  })

  return {
    ...view,
    customMock: harness.customMock,
    invalidateSpy: harness.invalidateSpy,
    notifications: harness.notifications,
    openMock: harness.openMock,
  }
}

beforeEach(async () => {
  trackMock.mockClear()
  await i18n.changeLanguage("en")
})

describe("useRolesBulkActions — update", () => {
  it("sends the patch, notifies, tracks, clears the selection, and invalidates the list", async () => {
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const { result, customMock, invalidateSpy, notifications, openMock } =
      renderBulkActions({
        selected: ROLES,
        onDone,
        custom: async () => ({ data: { updated: 2, failed: [] } }),
      })

    act(() => {
      result.current.bulkUpdate(
        { status: "inactive" },
        { onSettled }
      )
    })

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())

    expect(customMock).toHaveBeenCalledOnce()
    expect(customMock.mock.calls[0]?.[0]).toMatchObject({
      url: "/api/roles/bulk",
      method: "patch",
      payload: { ids: ["rol_admin", "rol_member"], status: "inactive" },
    })
    expect(notifications).toEqual([
      { message: "Roles updated: 2", type: "success" },
    ])
    expect(trackMock).toHaveBeenCalledWith("role.bulk_action", {
      action: "update",
      selected: 2,
      updated: 2,
      failed: 0,
    })
    expect(onDone).toHaveBeenCalledOnce()
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["data", "default", "roles", "list"],
      })
    )

    // Lifecycle order: notify → track → clear selection → invalidate → settle.
    const order = [
      openMock.mock.invocationCallOrder[0],
      trackMock.mock.invocationCallOrder[0],
      onDone.mock.invocationCallOrder[0],
      invalidateSpy.mock.invocationCallOrder[0],
      onSettled.mock.invocationCallOrder[0],
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("reports per-row failures with titles resolved from the selection", async () => {
    const onDone = vi.fn()
    const { result, customMock, invalidateSpy, notifications } =
      renderBulkActions({
        selected: ROLES,
        onDone,
        custom: async () => ({
          data: {
            updated: 1,
            failed: [
              { id: "rol_admin", reason: "system_role" },
              { id: "rol_member", reason: "referenced" },
            ],
          },
        }),
      })

    act(() => {
      // No client-side gating by reason: the status patch goes out as-is.
      result.current.bulkUpdate({ status: "inactive" })
    })

    await waitFor(() => expect(notifications).toHaveLength(1))

    expect(customMock.mock.calls[0]?.[0]).toMatchObject({
      url: "/api/roles/bulk",
      method: "patch",
      payload: { ids: ["rol_admin", "rol_member"], status: "inactive" },
    })
    expect(notifications).toEqual([
      {
        message: "Roles updated: 1 · failed: 2",
        description: "Administrator: system role; Member: assigned to a user",
        type: "error",
      },
    ])
    expect(trackMock).toHaveBeenCalledWith("role.bulk_action", {
      action: "update",
      selected: 2,
      updated: 1,
      failed: 2,
    })
    expect(onDone).toHaveBeenCalledOnce()
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["data", "default", "roles", "list"],
      })
    )
  })

  it("falls back to the failure id when the row is not in the selection", async () => {
    const { result, notifications } = renderBulkActions({
      selected: ROLES,
      custom: async () => ({
        data: {
          updated: 1,
          failed: [{ id: "rol_ghost", reason: "not_found" }],
        },
      }),
    })

    act(() => {
      result.current.bulkUpdate({ status: "active" })
    })

    await waitFor(() => expect(notifications).toHaveLength(1))
    expect(notifications[0]).toMatchObject({
      message: "Roles updated: 1 · failed: 1",
      description: "rol_ghost: not found",
      type: "error",
    })
  })

  it("surfaces transport errors without clearing the selection or invalidating", async () => {
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const { result, invalidateSpy, notifications } = renderBulkActions({
      selected: ROLES,
      onDone,
      custom: async () => {
        throw {
          message: "Roles service unavailable",
          response: { data: { message: "Roles service unavailable" } },
        }
      },
    })

    act(() => {
      result.current.bulkUpdate({ status: "inactive" }, { onSettled })
    })

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())

    expect(notifications).toEqual([
      {
        message: "Bulk action failed",
        description: "Roles service unavailable",
        type: "error",
      },
    ])
    expect(trackMock).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

describe("useRolesBulkActions — delete", () => {
  it("sends the ids, notifies, tracks, clears the selection, and invalidates the list", async () => {
    const onDone = vi.fn()
    const onSettled = vi.fn()
    const { result, customMock, invalidateSpy, notifications } =
      renderBulkActions({
        selected: ROLES,
        onDone,
        custom: async () => ({ data: { deleted: 2, failed: [] } }),
      })

    act(() => {
      result.current.bulkDelete({ onSettled })
    })

    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())

    expect(customMock).toHaveBeenCalledOnce()
    expect(customMock.mock.calls[0]?.[0]).toMatchObject({
      url: "/api/roles/bulk-delete",
      method: "post",
      payload: { ids: ["rol_admin", "rol_member"] },
    })
    expect(notifications).toEqual([
      { message: "Roles deleted: 2", type: "success" },
    ])
    expect(trackMock).toHaveBeenCalledWith("role.bulk_action", {
      action: "delete",
      selected: 2,
      deleted: 2,
      failed: 0,
    })
    expect(onDone).toHaveBeenCalledOnce()
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["data", "default", "roles", "list"],
      })
    )
  })

  it("reports per-row delete failures as an error notification", async () => {
    const onDone = vi.fn()
    const { result, notifications, invalidateSpy } = renderBulkActions({
      selected: ROLES,
      onDone,
      custom: async () => ({
        data: {
          deleted: 1,
          failed: [{ id: "rol_member", reason: "referenced" }],
        },
      }),
    })

    act(() => {
      result.current.bulkDelete()
    })

    await waitFor(() => expect(notifications).toHaveLength(1))

    expect(notifications).toEqual([
      {
        message: "Roles deleted: 1 · failed: 1",
        description: "Member: assigned to a user",
        type: "error",
      },
    ])
    expect(trackMock).toHaveBeenCalledWith("role.bulk_action", {
      action: "delete",
      selected: 2,
      deleted: 1,
      failed: 1,
    })
    expect(onDone).toHaveBeenCalledOnce()
    expect(invalidateSpy).toHaveBeenCalledOnce()
  })
})

describe("useRolesBulkActions — selection and applying state", () => {
  it("does not call the data provider when nothing is selected", () => {
    const onDone = vi.fn()
    const { result, customMock, invalidateSpy, notifications } =
      renderBulkActions({ selected: [], onDone })

    act(() => {
      result.current.bulkUpdate({ status: "inactive" })
      result.current.bulkDelete()
    })

    expect(customMock).not.toHaveBeenCalled()
    expect(notifications).toEqual([])
    expect(trackMock).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it("isApplying is true while an update is pending and false after it settles", async () => {
    const gate = deferred<{ data: unknown }>()
    const { result } = renderBulkActions({
      selected: ROLES,
      custom: () => gate.promise,
    })

    expect(result.current.isApplying).toBe(false)

    act(() => {
      result.current.bulkUpdate({ status: "inactive" })
    })
    await waitFor(() => expect(result.current.isApplying).toBe(true))

    await act(async () => {
      gate.resolve({ data: { updated: 2, failed: [] } })
      await gate.promise
    })
    await waitFor(() => expect(result.current.isApplying).toBe(false))
  })

  it("isApplying is true while a delete is pending and false after it settles", async () => {
    const gate = deferred<{ data: unknown }>()
    const { result } = renderBulkActions({
      selected: ROLES,
      custom: () => gate.promise,
    })

    act(() => {
      result.current.bulkDelete()
    })
    await waitFor(() => expect(result.current.isApplying).toBe(true))

    await act(async () => {
      gate.resolve({ data: { deleted: 2, failed: [] } })
      await gate.promise
    })
    await waitFor(() => expect(result.current.isApplying).toBe(false))
  })
})
