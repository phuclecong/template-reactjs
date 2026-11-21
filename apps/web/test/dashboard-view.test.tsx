// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { DashboardSummary } from "@workspace/api/schemas"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@/utils/i18n"
import { DashboardView } from "@/features/dashboard"
import { useTaskSummary } from "@/features/dashboard/hooks/use-task-summary"

vi.mock("@/features/dashboard/hooks/use-task-summary", () => ({
  useTaskSummary: vi.fn(),
}))

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const summary: DashboardSummary = {
  totals: { total: 10, open: 6, overdue: 2, completionRate: 0.4 },
  byStatus: [
    { status: "todo", count: 4 },
    { status: "in-progress", count: 2 },
    { status: "done", count: 4 },
    { status: "blocked", count: 0 },
  ],
  byPriority: [
    { priority: "low", count: 3 },
    { priority: "medium", count: 4 },
    { priority: "high", count: 2 },
    { priority: "unassigned", count: 1 },
  ],
  byAssignee: [
    { assigneeId: "usr_member", name: "Mia Member", count: 6 },
    { assigneeId: null, name: "", count: 1 },
  ],
  generatedAt: "2026-06-15T12:00:00.000Z",
}

const mockedSummary = vi.mocked(useTaskSummary)
const refetch = vi.fn()

function mockSummary(
  overrides: Partial<ReturnType<typeof useTaskSummary>> = {}
): void {
  mockedSummary.mockReturnValue({
    summary,
    isLoading: false,
    isError: false,
    refetch,
    liveStatus: "live",
    ...overrides,
  })
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub)
  mockSummary()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("DashboardView", () => {
  it("renders the KPI cards and the chart data tables", () => {
    render(<DashboardView />)

    expect(screen.getByTestId("dashboard-kpi-total")).toHaveTextContent("10")
    expect(screen.getByTestId("dashboard-kpi-open")).toHaveTextContent("6")
    expect(screen.getByTestId("dashboard-kpi-overdue")).toHaveTextContent("2")
    expect(screen.getByTestId("dashboard-kpi-completion")).toHaveTextContent(
      "40%"
    )

    const tables = screen.getAllByRole("table", { hidden: true })
    expect(tables).toHaveLength(3)
    const statusTable = tables[0]!
    const todoRow = within(statusTable).getByText("To do").closest("tr")!
    expect(within(todoRow).getByText("4")).toBeInTheDocument()
    expect(within(tables[2]!).getByText("Unassigned")).toBeInTheDocument()
  })

  it("renders the live status and the demo label for the mock backend", () => {
    render(<DashboardView />)

    expect(screen.getByRole("status")).toHaveTextContent("Live demo")
  })

  it("shows the loading skeleton while the summary loads", () => {
    mockSummary({ isLoading: true, summary: undefined })

    render(<DashboardView />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard…")
    expect(screen.queryByTestId("dashboard-kpi-total")).not.toBeInTheDocument()
  })

  it("shows the error state and retries on demand", async () => {
    mockSummary({ isError: true, summary: undefined })

    render(<DashboardView />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load the dashboard."
    )
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("shows an empty state when there are no assignees", () => {
    mockSummary({
      summary: { ...summary, byAssignee: [] },
    })

    render(<DashboardView />)

    expect(screen.getByText("No tasks to chart yet.")).toBeInTheDocument()
  })
})
