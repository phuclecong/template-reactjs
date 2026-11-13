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

function renderFilter(values: TaskFilters = emptyFilters) {
  const props = {
    searchValue: "",
    onSearchChange: vi.fn(),
    users: [],
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
        users={[]}
        onChange={(next) => {
          setValues(next)
          onChange(next)
        }}
        onClear={() => {}}
      />
    </I18nextProvider>
  )
}

describe("TaskFiltersBar status filter", () => {
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
