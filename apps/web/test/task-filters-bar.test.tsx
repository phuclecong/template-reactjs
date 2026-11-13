// @vitest-environment jsdom
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { TaskFiltersBar } from "@/features/tasks/components/task-filters-bar"
import type { TaskFilters } from "@/features/tasks/utils"

const emptyFilters: TaskFilters = {
  status: "",
  priority: "",
  assignee: "",
  dueFrom: "",
  dueTo: "",
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

afterEach(async () => {
  await i18n.changeLanguage("en")
})

const users = [
  { id: "usr_admin", name: "Ada Admin" },
  { id: "usr_member", name: "Mia Member" },
]

function renderFilter(
  values: TaskFilters = emptyFilters,
  filterUsers = users
) {
  const props = {
    searchValue: "",
    onSearchChange: vi.fn(),
    users: filterUsers,
    onChange: vi.fn(),
    onClear: vi.fn(),
  }

  render(
    <I18nextProvider i18n={i18n}>
      <TaskFiltersBar values={values} {...props} />
    </I18nextProvider>
  )

  return props
}

function Harness({
  initial = emptyFilters,
  onChange,
}: {
  initial?: TaskFilters
  onChange: (next: TaskFilters) => void
}) {
  const [values, setValues] = useState(initial)

  return (
    <I18nextProvider i18n={i18n}>
      <TaskFiltersBar
        searchValue=""
        onSearchChange={() => {}}
        values={values}
        users={users}
        onChange={(next) => {
          setValues(next)
          onChange(next)
        }}
        onClear={() => {}}
      />
    </I18nextProvider>
  )
}

/**
 * Mirrors production, where the URL is the source of truth and `navigate()` is
 * asynchronous: a change is emitted but the new `values` prop does not arrive
 * until the URL round-trip commits. Keeping the prop frozen reproduces two
 * rapid selections landing before that re-render.
 */
function DelayedHarness({
  onChange,
}: {
  onChange: (next: TaskFilters) => void
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <TaskFiltersBar
        searchValue=""
        onSearchChange={() => {}}
        values={emptyFilters}
        users={users}
        onChange={onChange}
        onClear={() => {}}
      />
    </I18nextProvider>
  )
}

describe("TaskFiltersBar status filter", () => {
  it("has no field clear control when nothing is selected", () => {
    renderFilter()

    expect(
      screen.queryByRole("button", { name: "Clear", exact: true })
    ).toBeNull()
  })

  it("is a Status combobox with a localized All placeholder and no All option", async () => {
    const user = userEvent.setup()
    renderFilter()

    const input = screen.getByRole("combobox", { name: "Status" })
    expect(input).toHaveAttribute("placeholder", "All")

    await user.click(input)

    expect(await screen.findByRole("listbox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "todo" })).toBeVisible()
    expect(screen.getByRole("option", { name: "in-progress" })).toBeVisible()
    expect(screen.getByRole("option", { name: "done" })).toBeVisible()
    expect(screen.getByRole("option", { name: "blocked" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "All" })
    ).not.toBeInTheDocument()
  })

  it("selects several statuses and emits the comma-joined value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const input = screen.getByRole("combobox", { name: "Status" })
    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "todo" }))

    // Multi-select keeps the popup open so another value can be picked.
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "in-progress" }))

    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      status: "todo,in-progress",
    })
    expect(screen.getByRole("button", { name: "Remove todo" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Remove in-progress" })
    ).toBeVisible()
  })

  it("keeps both values when two selections land before the URL updates", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DelayedHarness onChange={onChange} />)

    const input = screen.getByRole("combobox", { name: "Status" })
    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "todo" }))
    // The parent has not re-rendered with the URL value yet, but the second
    // click must still build on the first optimistic selection.
    await user.click(screen.getByRole("option", { name: "in-progress" }))

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      status: "todo,in-progress",
    })
  })

  it("removes a single status from its chip", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ ...emptyFilters, status: "todo,done" }}
        onChange={onChange}
      />
    )

    expect(screen.getByRole("button", { name: "Remove todo" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Remove todo" }))

    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      status: "done",
    })
    expect(
      screen.queryByRole("button", { name: "Remove todo" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove done" })).toBeVisible()
  })

  it("clears the status field with the field clear control", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ ...emptyFilters, status: "done" }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Clear", exact: true }))

    expect(onChange).toHaveBeenLastCalledWith(emptyFilters)
    expect(
      screen.queryByRole("button", { name: "Remove done" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Status" })
    ).toHaveAttribute("placeholder", "All")
  })

  it("localizes the placeholder and the status labels", async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage("vi")
    renderFilter()

    const input = screen.getByRole("combobox", { name: "Trạng thái" })
    expect(input).toHaveAttribute("placeholder", "Tất cả")

    await user.click(input)

    expect(
      await screen.findByRole("option", { name: "Việc cần làm" })
    ).toBeVisible()
  })
})

describe("TaskFiltersBar priority filter", () => {
  it("is a Priority combobox with a localized All placeholder and no All option", async () => {
    const user = userEvent.setup()
    renderFilter()

    const input = screen.getByRole("combobox", { name: "Priority" })
    expect(input).toHaveAttribute("placeholder", "All")

    await user.click(input)

    expect(await screen.findByRole("listbox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "low" })).toBeVisible()
    expect(screen.getByRole("option", { name: "medium" })).toBeVisible()
    expect(screen.getByRole("option", { name: "high" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "All" })
    ).not.toBeInTheDocument()
  })

  it("selects several priorities and emits the comma-joined value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const input = screen.getByRole("combobox", { name: "Priority" })
    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "low" }))

    // Multi-select keeps the popup open so another value can be picked.
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "high" }))

    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      priority: "low,high",
    })
    expect(screen.getByRole("button", { name: "Remove low" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Remove high" })).toBeVisible()
  })

  it("removes a single priority from its chip", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ ...emptyFilters, priority: "low,high" }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Remove low" }))

    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      priority: "high",
    })
    expect(
      screen.queryByRole("button", { name: "Remove low" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove high" })).toBeVisible()
  })

  it("clears the priority field with the field clear control", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ ...emptyFilters, priority: "high" }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Clear", exact: true }))

    expect(onChange).toHaveBeenLastCalledWith(emptyFilters)
    expect(
      screen.queryByRole("button", { name: "Remove high" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: "Priority" })
    ).toHaveAttribute("placeholder", "All")
  })
})

describe("TaskFiltersBar assignee filter", () => {
  it("is an Assignee combobox that shows names but emits ids", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const input = screen.getByRole("combobox", { name: "Assignee" })
    expect(input).toHaveAttribute("placeholder", "All")

    await user.click(input)

    expect(await screen.findByRole("listbox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Ada Admin" })).toBeVisible()
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "All" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "Ada Admin" }))
    await user.click(screen.getByRole("option", { name: "Unassigned" }))

    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      assignee: "usr_admin,unassigned",
    })
    expect(
      screen.getByRole("button", { name: "Remove Ada Admin" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Remove Unassigned" })
    ).toBeVisible()
  })

  it("removes a single assignee from its chip", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ ...emptyFilters, assignee: "usr_admin,unassigned" }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Remove Unassigned" }))

    expect(onChange).toHaveBeenLastCalledWith({
      ...emptyFilters,
      assignee: "usr_admin",
    })
    expect(
      screen.queryByRole("button", { name: "Remove Unassigned" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Remove Ada Admin" })
    ).toBeVisible()
  })

  it("clears the assignee field with the field clear control", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        initial={{ ...emptyFilters, assignee: "usr_member" }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Clear", exact: true }))

    expect(onChange).toHaveBeenLastCalledWith(emptyFilters)
    expect(
      screen.getByRole("combobox", { name: "Assignee" })
    ).toHaveAttribute("placeholder", "All")
  })
})
