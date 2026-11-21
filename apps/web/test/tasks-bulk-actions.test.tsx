// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  useTaskBulkActions,
  type TaskBulkPatch,
} from "@/features/tasks/hooks/use-task-bulk-actions"
import { track } from "@/observability"
import i18n from "@/utils/i18n"
import {
  createBulkHarness,
  type BulkCustomCall,
  type BulkResult,
} from "./bulk-harness"

vi.mock("@/observability", () => ({ track: vi.fn() }))

type SelectedTask = { id: string; title: string }

type HarnessOptions = {
  selected?: SelectedTask[]
  result?: BulkResult
  custom?: (call: BulkCustomCall) => Promise<{ data: unknown }>
}

const SELECTED: SelectedTask[] = [
  { id: "task_1", title: "Alpha" },
  { id: "task_2", title: "Bravo" },
]

function makeHarness(options: HarnessOptions = {}) {
  const selected = options.selected ?? SELECTED
  const onDone = vi.fn()

  const harness = createBulkHarness({
    resources: [{ name: "tasks" }],
    withRouter: true,
    respond: (call) => {
      if (options.custom) return options.custom(call)
      return Promise.resolve({
        data: options.result ?? { updated: selected.length, failed: [] },
      })
    },
  })

  const view = renderHook(() => useTaskBulkActions({ selected, onDone }), {
    wrapper: harness.Wrapper,
  })

  return {
    ...view,
    calls: harness.calls,
    custom: harness.customMock,
    notifications: harness.notifications,
    invalidateSpy: harness.invalidateSpy,
    onDone,
    queryClient: harness.queryClient,
  }
}

async function apply(
  harness: ReturnType<typeof makeHarness>,
  patch: TaskBulkPatch,
  options?: { onSettled?: () => void }
) {
  await act(async () => {
    harness.result.current.bulkUpdate(patch, options)
  })
}

function invalidatedTasksList(
  spy: ReturnType<typeof vi.spyOn>
): boolean {
  return spy.mock.calls.some(([filters]) => {
    const queryKey = (filters as { queryKey?: unknown[] } | undefined)?.queryKey
    return (
      Array.isArray(queryKey) &&
      queryKey.includes("tasks") &&
      queryKey.includes("list")
    )
  })
}

beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage("en")
})

describe("useTaskBulkActions: update lifecycle", () => {
  it("PATCHes the selected ids with the patch and reports success", async () => {
    const onSettled = vi.fn()
    const harness = makeHarness({ result: { updated: 2, failed: [] } })

    await apply(harness, { status: "done" }, { onSettled })
    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())

    expect(harness.custom).toHaveBeenCalledOnce()
    expect(harness.calls[0]).toMatchObject({
      url: "/api/tasks/bulk",
      method: "patch",
      payload: { ids: ["task_1", "task_2"], status: "done" },
    })

    expect(harness.notifications).toEqual([
      { message: "Updated 2 tasks", type: "success" },
    ])
    expect(vi.mocked(track)).toHaveBeenCalledOnce()
    expect(vi.mocked(track)).toHaveBeenCalledWith("task.bulk_action", {
      action: "update",
      fields: ["status"],
      selected: 2,
      updated: 2,
      failed: 0,
    })
    expect(harness.onDone).toHaveBeenCalledOnce()
    expect(invalidatedTasksList(harness.invalidateSpy)).toBe(true)
  })
})

describe("useTaskBulkActions: analytics field names", () => {
  it("maps patch keys to analytics names in patch key order", async () => {
    const harness = makeHarness()

    await apply(harness, {
      dueDate: "2026-12-01T00:00:00.000Z",
      assigneeId: "usr_1",
      priority: "high",
      status: "done",
    })
    await waitFor(() => expect(harness.onDone).toHaveBeenCalledOnce())

    expect(vi.mocked(track)).toHaveBeenCalledWith(
      "task.bulk_action",
      expect.objectContaining({
        fields: ["due_date", "assignee", "priority", "status"],
      })
    )
  })
})

describe("useTaskBulkActions: per-row failures", () => {
  it("reports failed rows by title and still clears and invalidates", async () => {
    const harness = makeHarness({
      result: {
        updated: 1,
        failed: [{ id: "task_2", reason: "not_found" }],
      },
    })

    await apply(harness, { status: "done" })
    await waitFor(() => expect(harness.onDone).toHaveBeenCalledOnce())

    expect(harness.notifications).toEqual([
      {
        message: "Updated 1 tasks, 1 failed",
        description: "Bravo: not found",
        type: "error",
      },
    ])
    expect(vi.mocked(track)).toHaveBeenCalledWith("task.bulk_action", {
      action: "update",
      fields: ["status"],
      selected: 2,
      updated: 1,
      failed: 1,
    })
    expect(invalidatedTasksList(harness.invalidateSpy)).toBe(true)
  })

  it("translates known reasons and shows unknown reasons raw", async () => {
    const harness = makeHarness({
      result: {
        updated: 0,
        failed: [
          { id: "task_1", reason: "forbidden" },
          { id: "ghost", reason: "conflict" },
        ],
      },
    })

    await apply(harness, { status: "done" })
    await waitFor(() => expect(harness.onDone).toHaveBeenCalledOnce())

    expect(harness.notifications).toEqual([
      {
        message: "Updated 0 tasks, 2 failed",
        description: "Alpha: not permitted; ghost: conflict",
        type: "error",
      },
    ])
    expect(vi.mocked(track)).toHaveBeenCalledWith(
      "task.bulk_action",
      expect.objectContaining({ updated: 0, failed: 2 })
    )
  })
})

describe("useTaskBulkActions: transport failure", () => {
  it("notifies with the described error and does not clear or invalidate", async () => {
    const onSettled = vi.fn()
    const harness = makeHarness({
      custom: () =>
        Promise.reject({ statusCode: 500, message: "Network down" }),
    })

    await apply(harness, { status: "done" }, { onSettled })
    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce())

    expect(harness.notifications).toEqual([
      {
        message: "Bulk update failed",
        description: "Network down",
        type: "error",
      },
    ])
    expect(harness.onDone).not.toHaveBeenCalled()
    expect(harness.invalidateSpy).not.toHaveBeenCalled()
    expect(vi.mocked(track)).not.toHaveBeenCalled()
  })
})

describe("useTaskBulkActions: selection and pending state", () => {
  it("does nothing when the selection is empty", async () => {
    const onSettled = vi.fn()
    const harness = makeHarness({ selected: [] })

    await apply(harness, { status: "done" }, { onSettled })

    expect(harness.custom).not.toHaveBeenCalled()
    expect(harness.notifications).toEqual([])
    expect(harness.onDone).not.toHaveBeenCalled()
    expect(harness.invalidateSpy).not.toHaveBeenCalled()
    expect(vi.mocked(track)).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
    expect(harness.result.current.isApplying).toBe(false)
  })

  it("reports isApplying only while the mutation is pending", async () => {
    let resolveCustom!: (value: { data: unknown }) => void
    const harness = makeHarness({
      custom: () =>
        new Promise((resolve) => {
          resolveCustom = resolve
        }),
    })

    expect(harness.result.current.isApplying).toBe(false)

    act(() => {
      harness.result.current.bulkUpdate({ status: "done" })
    })
    await waitFor(() => expect(harness.result.current.isApplying).toBe(true))

    await act(async () => {
      resolveCustom({ data: { updated: 2, failed: [] } })
    })
    await waitFor(() => expect(harness.result.current.isApplying).toBe(false))
  })

  it("exposes no delete action", () => {
    const harness = makeHarness()

    expect(harness.result.current).not.toHaveProperty("bulkDelete")
    expect(Object.keys(harness.result.current).sort()).toEqual([
      "bulkUpdate",
      "isApplying",
    ])
  })
})
