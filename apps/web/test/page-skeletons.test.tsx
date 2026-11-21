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

  it("mirrors the resolved shell's header-over-scroll-region structure", () => {
    const { container } = renderWithI18n(<AppShellSkeleton />)

    const root = container.firstElementChild as HTMLElement
    expect(root).not.toBeNull()

    const header = root.querySelector<HTMLElement>("header")
    const content = root.querySelector<HTMLElement>(
      '[data-slot="shell-content"]'
    )
    expect(header).not.toBeNull()
    expect(content).not.toBeNull()

    // The header is outside the scrolling region, exactly as in the real shell.
    expect(content).not.toContainElement(header)
    expect(header?.nextElementSibling).toBe(content)
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

  it("renders the table skeleton inside the shared viewport-fitted page frame", () => {
    const { container } = renderWithI18n(<TablePageSkeleton kind="tasks" />)

    const frame = container.querySelector<HTMLElement>(
      '[data-slot="table-page-layout"]'
    )
    expect(frame).not.toBeNull()

    // The skeleton grid and its pinned footer both live inside the shared
    // page frame, so the route skeleton and the real table share one contract.
    const grid = frame?.querySelector<HTMLElement>(
      '[data-slot="table-skeleton"]'
    )
    const footer = frame?.querySelector<HTMLElement>(
      '[data-slot="table-skeleton-footer"]'
    )
    expect(grid).not.toBeNull()
    expect(footer).not.toBeNull()
    expect(grid?.parentElement).toBe(footer?.parentElement)
    expect(grid?.nextElementSibling).toBe(footer)
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
