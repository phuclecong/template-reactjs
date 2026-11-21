// @vitest-environment jsdom
import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { UsersFilterBar } from "@/features/users/components/users-filter-bar"

async function renderFilter(
  overrides: Partial<ComponentProps<typeof UsersFilterBar>> = {},
  language = "en"
) {
  await i18n.changeLanguage(language)

  const props = {
    searchValue: "",
    onSearchChange: vi.fn(),
    roleId: "",
    roleOptions: [
      { value: "rol_admin", label: "Administrator" },
      { value: "rol_member", label: "Member" },
    ],
    onRoleChange: vi.fn(),
    ...overrides,
  }

  render(
    <I18nextProvider i18n={i18n}>
      <UsersFilterBar {...props} />
    </I18nextProvider>
  )

  return props
}

/** The registry keeps the clear control internal; its `data-slot` is the
 * contract the theme and consumers can target. */
function getClearControl() {
  const clear = document.querySelector<HTMLButtonElement>(
    '[data-slot="combobox-clear"]'
  )
  if (!clear) throw new Error("Combobox clear control not found")
  return clear
}

describe("UsersFilterBar role filter", () => {
  it("is a searchable Role combobox with a Role placeholder and no All option", async () => {
    const user = userEvent.setup()
    await renderFilter()

    const input = screen.getByRole("combobox", { name: "Role" })
    expect(input).toHaveAttribute("placeholder", "Role")
    expect(
      document.querySelector('[data-slot="combobox-clear"]')
    ).not.toBeInTheDocument()

    await user.click(input)

    expect(await screen.findByRole("listbox")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Administrator" })).toBeVisible()
    expect(screen.getByRole("option", { name: "Member" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "All" })
    ).not.toBeInTheDocument()
  })

  it("filters the options and emits the chosen role", async () => {
    const user = userEvent.setup()
    const props = await renderFilter()

    const input = screen.getByRole("combobox", { name: "Role" })
    await user.click(input)
    await user.type(input, "mem")

    expect(screen.getByRole("option", { name: "Member" })).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "Administrator" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "Member" }))

    expect(props.onRoleChange).toHaveBeenCalledWith("rol_member")
  })

  it("shows the selected role and clears it", async () => {
    const user = userEvent.setup()
    const props = await renderFilter({ roleId: "rol_member" })

    const input = screen.getByRole("combobox", { name: "Role" })
    expect(input).toHaveValue("Member")

    await user.click(getClearControl())

    expect(props.onRoleChange).toHaveBeenCalledWith("")
  })

  it("localizes the placeholder while Role titles stay data", async () => {
    const user = userEvent.setup()
    await renderFilter({}, "vi")

    const input = screen.getByRole("combobox", { name: "Vai trò" })
    expect(input).toHaveAttribute("placeholder", "Vai trò")

    await user.click(input)

    // Role titles are records, not interface strings.
    expect(
      await screen.findByRole("option", { name: "Administrator" })
    ).toBeVisible()
  })
})

describe("UsersFilterBar clear action", () => {
  it("renders the English clear label instead of a raw translation key", async () => {
    await renderFilter()

    expect(screen.getByRole("button", { name: "Clear" })).toHaveTextContent(
      "Clear"
    )
  })

  it("renders the Vietnamese clear label instead of a raw translation key", async () => {
    await renderFilter({}, "vi")

    expect(screen.getByRole("button", { name: "Xóa" })).toHaveTextContent("Xóa")
  })
})
