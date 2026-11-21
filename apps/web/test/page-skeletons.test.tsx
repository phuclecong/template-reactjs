// @vitest-environment jsdom
import type { ReactElement } from "react"
import { render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import {
  AppShellSkeleton,
  AuthPageSkeleton,
  SettingsPageSkeleton,
  TablePageSkeleton,
} from "@/components/page-skeletons"

function renderWithI18n(element: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>)
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("auth and shell skeletons", () => {
  it("announces loading on the auth screen without showing identity or data", () => {
    renderWithI18n(<AuthPageSkeleton />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading…")
    expect(screen.queryByText("Ada Admin")).toBeNull()
    expect(screen.queryByText("admin@example.com")).toBeNull()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("renders a neutral app frame without identity or task data", () => {
    renderWithI18n(<AppShellSkeleton />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading…")
    expect(screen.queryByText("Ada Admin")).toBeNull()
    expect(screen.queryByText("Tasks")).toBeNull()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("locks the pre-identity frame to the viewport like the resolved shell", () => {
    const { container } = renderWithI18n(<AppShellSkeleton />)

    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveClass("h-svh", "overflow-hidden")
    expect(root).not.toHaveClass("min-h-svh")

    // The content region is the page-level scroll surface, not the window.
    const main = container.querySelector("main") as HTMLElement
    expect(main).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
  })
})

describe("page skeletons", () => {
  it("reserves the Tasks table columns and page size while the route loads", () => {
    const { container } = renderWithI18n(<TablePageSkeleton kind="tasks" />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading tasks…")
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("columnheader")).toBeNull()

    const rows = container.querySelectorAll('[data-slot="table-skeleton-row"]')
    expect(rows).toHaveLength(30)

    const cells = rows[0].querySelectorAll('[data-slot="table-skeleton-cell"]')
    expect(
      Array.from(cells).map((cell) =>
        Number((cell as HTMLElement).style.width.replace("px", ""))
      )
    ).toEqual([36, 360, 120, 120, 180, 200, 140])
  })

  it("reserves the Users table columns and announces users loading", () => {
    const { container } = renderWithI18n(<TablePageSkeleton kind="users" />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading users…")

    const cells = container.querySelectorAll(
      '[data-slot="table-skeleton-row"] [data-slot="table-skeleton-cell"]'
    )
    expect(
      Array.from(cells)
        .slice(0, 4)
        .map((cell) =>
          Number((cell as HTMLElement).style.width.replace("px", ""))
        )
    ).toEqual([220, 300, 160, 100])
  })

  it("announces loading on the settings page skeleton", () => {
    renderWithI18n(<SettingsPageSkeleton />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading…")
    expect(screen.queryByRole("button")).toBeNull()
  })
})
