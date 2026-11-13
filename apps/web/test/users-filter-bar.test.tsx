// @vitest-environment jsdom
import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { UsersFilterBar } from "@/features/users/components/users-filter-bar"

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

afterEach(async () => {
  await i18n.changeLanguage("en")
})

function renderFilter(
  overrides: Partial<ComponentProps<typeof UsersFilterBar>> = {}
) {
  const props = {
    searchValue: "",
    onSearchChange: vi.fn(),
    role: "",
    onRoleChange: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  }

  render(
    <I18nextProvider i18n={i18n}>
      <UsersFilterBar {...props} />
    </I18nextProvider>
  )

  return props
}

describe("UsersFilterBar role filter", () => {
  it("is a searchable Role combobox with an All placeholder and no All option", async () => {
    const user = userEvent.setup()
    renderFilter()

    const input = screen.getByRole("combobox", { name: "Role" })
    expect(input).toHaveAttribute("placeholder", "All")

    await user.click(input)

    expect(await screen.findByRole("listbox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "admin" })).toBeVisible()
    expect(screen.getByRole("option", { name: "member" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "All" })
    ).not.toBeInTheDocument()
  })

  it("filters the options and emits the chosen role", async () => {
    const user = userEvent.setup()
    const props = renderFilter()

    const input = screen.getByRole("combobox", { name: "Role" })
    await user.click(input)
    await user.type(input, "mem")

    expect(screen.getByRole("option", { name: "member" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "admin" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "member" }))

    expect(props.onRoleChange).toHaveBeenCalledWith("member")
  })

  it("shows the selected role and clears it", async () => {
    const user = userEvent.setup()
    const props = renderFilter({ role: "admin" })

    expect(screen.getByRole("combobox", { name: "Role" })).toHaveValue(
      "admin"
    )

    await user.click(screen.getByRole("button", { name: "Clear" }))

    expect(props.onRoleChange).toHaveBeenCalledWith("")
  })

  it("localizes the placeholder and the role labels", async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage("vi")
    renderFilter()

    const input = screen.getByRole("combobox", { name: "Vai trò" })
    expect(input).toHaveAttribute("placeholder", "Tất cả")

    await user.click(input)

    expect(
      await screen.findByRole("option", { name: "Quản trị viên" })
    ).toBeVisible()
  })
})
