// @vitest-environment jsdom
import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CrudFilter } from "@refinedev/core"

import i18n from "@/utils/i18n"
import { TasksFilterBar } from "@/features/tasks/components/tasks-filter-bar"
import {
  EMPTY_TASK_FILTERS,
  taskFiltersToCrud,
  type TaskFilterValues,
} from "@/features/tasks/utils/filters"

const users = [
  { id: "usr_admin", name: "Ada Admin" },
  { id: "usr_member", name: "Mia Member" },
]

function filtersFor(values: Partial<TaskFilterValues>): CrudFilter[] {
  return taskFiltersToCrud({ ...EMPTY_TASK_FILTERS, ...values })
}

function Harness({
  initial = [],
  onChange,
}: {
  initial?: CrudFilter[]
  onChange: (next: CrudFilter[]) => void
}) {
  const [filters, setFilters] = useState<CrudFilter[]>(initial)

  return (
    <I18nextProvider i18n={i18n}>
      <TasksFilterBar
        filters={filters}
        users={users}
        onChange={(next) => {
          setFilters(next)
          onChange(next)
        }}
      />
    </I18nextProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

afterEach(async () => {
  await i18n.changeLanguage("en")
})

describe("TasksFilterBar collapsing", () => {
  it("collapses the controls while keeping the active chips visible", async () => {
    const user = userEvent.setup()
    render(
      <Harness initial={filtersFor({ status: "todo" })} onChange={vi.fn()} />
    )

    const toggle = screen.getByRole("button", { name: /^Filters/ })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible()

    await user.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByRole("combobox", { name: "Status" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Status: Todo")).toBeVisible()
    expect(screen.getByRole("button", { name: "Clear all" })).toBeVisible()

    await user.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible()
  })
})

describe("TasksFilterBar controls", () => {
  it("renders the labelled search and filter controls", () => {
    render(<Harness onChange={vi.fn()} />)

    expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Priority" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Assignee" })).toBeVisible()
  })

  it("localizes the controls", async () => {
    await i18n.changeLanguage("vi")
    render(<Harness onChange={vi.fn()} />)

    expect(screen.getByRole("combobox", { name: "Trạng thái" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Mức ưu tiên" })).toBeVisible()
  })
})

describe("TasksFilterBar status and priority filters", () => {
  it("emits an in filter for several statuses", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Status" }))
    await user.click(await screen.findByRole("option", { name: "Todo" }))
    await user.click(screen.getByRole("option", { name: "In-progress" }))

    expect(onChange).toHaveBeenLastCalledWith(
      filtersFor({ status: "todo,in-progress" })
    )
    expect(screen.getByRole("button", { name: "Remove Todo" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Remove In-progress" })
    ).toBeVisible()
  })

  it("removes one status from its chip", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={filtersFor({ status: "todo,done" })}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Remove Todo" }))

    expect(onChange).toHaveBeenLastCalledWith(filtersFor({ status: "done" }))
  })

  it("emits an in filter for several priorities", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Priority" }))
    await user.click(await screen.findByRole("option", { name: "Low" }))
    await user.click(screen.getByRole("option", { name: "High" }))

    expect(onChange).toHaveBeenLastCalledWith(
      filtersFor({ priority: "low,high" })
    )
  })
})

describe("TasksFilterBar assignee filter", () => {
  it("shows names but emits ids and the unassigned sentinel", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Assignee" }))
    await user.click(await screen.findByRole("option", { name: "Ada Admin" }))
    await user.click(screen.getByRole("option", { name: "Unassigned" }))

    expect(onChange).toHaveBeenLastCalledWith(
      filtersFor({ assignee: "usr_admin,unassigned" })
    )
  })
})

describe("TasksFilterBar search and chips", () => {
  it("debounces the search term into a contains filter", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(
      screen.getByRole("textbox", { name: "Search tasks" }),
      "release"
    )

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(filtersFor({ q: "release" }))
    )
  })

  it("renders a chip for the search term", () => {
    render(
      <Harness initial={filtersFor({ q: "release" })} onChange={vi.fn()} />
    )

    expect(screen.getByText("Search: release")).toBeVisible()
  })

  it("clears one external chip including both due-date bounds", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={filtersFor({
          dueFrom: "2026-01-01",
          dueTo: "2026-01-31",
        })}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: /Remove Due:/ }))

    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it("clears all filters", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={filtersFor({ status: "todo", priority: "high" })}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Clear all" }))

    expect(onChange).toHaveBeenLastCalledWith([])
  })
})
