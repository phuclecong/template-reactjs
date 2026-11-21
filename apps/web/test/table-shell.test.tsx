// @vitest-environment jsdom
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Refine, type DataProvider } from "@refinedev/core"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter, useLocation } from "react-router-dom"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RetryableLazy } from "@/components/retryable-lazy"
import i18n from "@/utils/i18n"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { useDialog } from "@workspace/shared-lib/hooks"
import { useTableShell } from "@workspace/shared-lib/hooks"
import {
  createSelectionColumn,
  TableShellView,
  type EmptyListProps,
} from "@workspace/shared-lib/components"
import { createTableUrlAdapter } from "@workspace/shared-lib/hooks"

type ProbeRow = {
  id: string
  name: string
  canSelect: boolean
}

const ROWS: ProbeRow[] = [
  { id: "one", name: "Alpha", canSelect: true },
  { id: "two", name: "Bravo", canSelect: false },
  { id: "three", name: "Charlie", canSelect: true },
]

/** A page large enough that the 600px test viewport cannot mount every row. */
const BIG_ROWS: ProbeRow[] = Array.from({ length: 80 }, (_, index) => ({
  id: `row-${index + 1}`,
  name: `Probe ${String(index + 1).padStart(2, "0")}`,
  canSelect: true,
}))

const adapter = createTableUrlAdapter({
  defaultSortField: "name",
  sortableFields: ["name"],
  ownedParams: ["q", "sort", "order", "page", "pageSize"],
  filters: [{ kind: "text", param: "q", field: "q" }],
})

type ListCall = {
  resource: string
  filters?: unknown[]
  pagination?: { currentPage?: number; pageSize?: number }
}

function makeDataProvider(
  rows: () => Promise<{ data: ProbeRow[]; total: number }>,
  onList?: (call: ListCall) => void
): DataProvider {
  return {
    getList: async ({
      resource,
      filters,
      pagination,
    }: {
      resource: string
      filters?: unknown[]
      pagination?: ListCall["pagination"]
    }) => {
      onList?.({ resource, filters, pagination })
      return rows()
    },
    getOne: async () => ({ data: {} }),
    create: async () => ({ data: {} }),
    update: async () => ({ data: {} }),
    deleteOne: async () => ({ data: {} }),
    getApiUrl: () => "/api",
  } as unknown as DataProvider
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

type OverlayMode = "none" | "ref" | "dialog"

type OverlayHandle = { open: (row: ProbeRow) => void }

/** Roles-style overlay: an imperative handle plus a caller-owned ConfirmDialog. */
const RefOverlay = forwardRef<OverlayHandle, { onConfirm: () => void }>(
  function RefOverlay({ onConfirm }, ref) {
    const [target, setTarget] = useState<ProbeRow | null>(null)
    useImperativeHandle(
      ref,
      () => ({
        open: (row: ProbeRow) => setTarget(row),
      }),
      []
    )
    return (
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`Delete ${target?.name ?? ""}`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={() => {
          onConfirm()
          setTarget(null)
        }}
      />
    )
  }
)

/** Tasks-style overlay: `useDialog` state driving a lazy chunk. */
const LazyOverlay = ({
  open,
  row,
  onClose,
}: {
  open: boolean
  row: ProbeRow | null
  onClose: () => void
}) => {
  if (!open) return null
  return (
    <div role="dialog" aria-label="Edit task">
      <span>{row?.name}</span>
      <button type="button" onClick={onClose}>
        Close overlay
      </button>
    </div>
  )
}

const overlayLoader = () =>
  Promise.resolve({ default: LazyOverlay } as {
    default: typeof LazyOverlay
  })

function ShellHarness({
  canSelect,
  initialVisibility,
  skeletonWidths = [40, 220, 100],
  empty = { title: "Nothing here yet." },
  overlay = "none",
}: {
  rows?: () => Promise<{ data: ProbeRow[]; total: number }>
  /** A predicate selects per row; omit it to use the boolean form. */
  canSelect?: (row: Row<ProbeRow>) => boolean
  initialEntries?: string[]
  initialVisibility?: Record<string, boolean>
  skeletonWidths?: number[]
  empty?: EmptyListProps
  overlay?: OverlayMode
  onList?: (call: ListCall) => void
}) {
  const [confirmed, setConfirmed] = useState<string[]>([])
  const refOverlay = useRef<OverlayHandle>(null)
  const dialog = useDialog<ProbeRow>()
  const openDialog = dialog.open

  const columns = useMemo<ColumnDef<ProbeRow>[]>(() => {
    const openRow = (row: ProbeRow) => {
      if (overlay === "ref") refOverlay.current?.open(row)
      if (overlay === "dialog") openDialog(row)
    }
    return [
      createSelectionColumn<ProbeRow>({
        width: 40,
        selectAllLabel: "Select all rows",
        selectRowLabel: (row) => `Select ${row.name}`,
      }),
      {
        accessorKey: "name",
        header: "Name",
        size: 220,
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        enableSorting: false,
        cell: ({ row }) =>
          overlay === "none" ? null : (
            <button type="button" onClick={() => openRow(row.original)}>
              Open overlay
            </button>
          ),
      },
    ]
  }, [overlay, openDialog])

  const shell = useTableShell<ProbeRow>({
    resource: "probe",
    parseUrl: adapter.parse,
    buildUrl: adapter.build,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection: canSelect ?? true,
    initialState: { columnVisibility: initialVisibility },
  })

  const { tableQuery, refineCore, reactTable } = shell

  return (
    <div>
      <output data-testid="shell-state">
        {JSON.stringify({
          page: shell.page,
          pageSize: shell.pageSize,
          pageCount: shell.pageCount,
          total: shell.total,
          selected: shell.selectedRows.map((row) => row.id),
          confirmed,
        })}
      </output>
      <button
        type="button"
        onClick={() =>
          shell.changeFilters([
            { field: "q", operator: "contains", value: "release" },
          ])
        }
      >
        Commit search filter
      </button>
      <button type="button" onClick={() => shell.goToPage(2)}>
        Go to page 2
      </button>
      <button type="button" onClick={() => shell.changePageSize(10)}>
        Change to 10 per page
      </button>
      <button
        type="button"
        onClick={() =>
          reactTable.setColumnVisibility((previous) => ({
            ...previous,
            actions: true,
            select: true,
          }))
        }
      >
        Show gated columns
      </button>
      <button type="button" onClick={shell.clearSelection}>
        Clear selection
      </button>
      <button
        type="button"
        onClick={() => void refineCore.tableQuery.refetch()}
      >
        Refetch via refineCore
      </button>
      <TableShellView
        table={reactTable}
        scrollResetKey={shell.stateKey}
        isLoading={tableQuery.isLoading}
        isError={tableQuery.isError}
        isRetrying={tableQuery.isFetching}
        onRetry={() => void tableQuery.refetch()}
        loadingLabel="Loading probes…"
        skeletonColumnWidths={skeletonWidths}
        skeletonRowCount={shell.pageSize}
        errorTitle="Could not load probes."
        errorDescription="Something broke."
        retryLabel="Try again"
        empty={empty}
        pagination={{
          page: shell.page,
          pageSize: shell.pageSize,
          pageCount: shell.pageCount,
          summary: `${shell.total} probes`,
          onPageChange: shell.goToPage,
          onPageSizeChange: shell.changePageSize,
        }}
      />
      <RefOverlay
        ref={refOverlay}
        onConfirm={() => setConfirmed([...confirmed, "confirmed"])}
      />
      {dialog.isOpen ? (
        <RetryableLazy
          key={dialog.version}
          loader={overlayLoader}
          props={{
            open: dialog.isOpen,
            row: dialog.data,
            onClose: dialog.close,
          }}
        />
      ) : null}
    </div>
  )
}

function renderHarness(props: Parameters<typeof ShellHarness>[0] = {}) {
  const listCalls: ListCall[] = []
  const provider = makeDataProvider(
    props.rows ?? (() => Promise.resolve({ data: ROWS, total: ROWS.length })),
    (call) => {
      listCalls.push(call)
      props.onList?.(call)
    }
  )

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={props.initialEntries ?? ["/probe"]}>
        <I18nextProvider i18n={i18n}>
          <Refine
            dataProvider={provider}
            resources={[{ name: "probe" }]}
            options={{
              syncWithLocation: false,
              disableTelemetry: true,
              reactQuery: {
                clientConfig: {
                  defaultOptions: { queries: { retry: false } },
                },
              },
            }}
          >
            {children}
          </Refine>
        </I18nextProvider>
        <LocationProbe />
      </MemoryRouter>
    )
  }

  const result = render(<ShellHarness {...props} />, { wrapper: Wrapper })
  return { ...result, listCalls }
}

function skeletonWidths(container: HTMLElement): number[] {
  const firstRow = container.querySelector('[data-slot="table-skeleton-row"]')
  if (!firstRow) return []
  return Array.from(
    firstRow.querySelectorAll('[data-slot="table-skeleton-cell"]')
  ).map((cell) => Number((cell as HTMLElement).style.width.replace("px", "")))
}

function shellState(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId("shell-state").textContent ?? "{}")
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("escape hatch 1: enableRowSelection boolean | predicate", () => {
  it("disables the row and select-all checkboxes a predicate rejects", async () => {
    renderHarness({ canSelect: (row) => row.original.canSelect })

    const alpha = await screen.findByRole("checkbox", { name: "Select Alpha" })
    const bravo = screen.getByRole("checkbox", { name: "Select Bravo" })
    const selectAll = screen.getByRole("checkbox", {
      name: "Select all rows",
    })

    expect(alpha).not.toHaveAttribute("aria-disabled", "true")
    expect(bravo).toHaveAttribute("aria-disabled", "true")
    expect(selectAll).not.toHaveAttribute("aria-disabled", "true")
  })

  it("disables select-all when the predicate rejects every row", async () => {
    renderHarness({ canSelect: () => false })

    await screen.findByRole("checkbox", { name: "Select Alpha" })
    expect(
      screen.getByRole("checkbox", { name: "Select all rows" })
    ).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByRole("checkbox", { name: "Select Bravo" })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("keeps the boolean form selecting every row", async () => {
    renderHarness({ canSelect: undefined })

    await screen.findByRole("checkbox", { name: "Select Alpha" })
    expect(
      screen.getByRole("checkbox", { name: "Select Bravo" })
    ).not.toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByRole("checkbox", { name: "Select all rows" })
    ).not.toHaveAttribute("aria-disabled", "true")
  })
})

describe("escape hatch 2: Roles-only column visibility", () => {
  it("toggles gated columns after mount without resetting the page or filters", async () => {
    const user = userEvent.setup()
    const { listCalls } = renderHarness({
      // Three pages, so the pagination handler is free to move to page 2.
      rows: () => Promise.resolve({ data: ROWS, total: 90 }),
      initialEntries: ["/probe?q=ada&page=2"],
      initialVisibility: { actions: false, select: false },
    })

    await screen.findByRole("cell", { name: "Alpha" })
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("page=2")
    )
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull()

    // A committed filter after mount is the state the toggle must preserve.
    await user.click(
      screen.getByRole("button", { name: "Commit search filter" })
    )
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "q=release"
      )
    )
    await user.click(screen.getByRole("button", { name: "Go to page 2" }))
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("page=2")
    )

    await user.click(screen.getByRole("button", { name: "Show gated columns" }))

    // The columns appear without rebuilding the table...
    expect(
      await screen.findByRole("columnheader", { name: "Actions" })
    ).toBeVisible()
    expect(
      screen.getByRole("checkbox", { name: "Select all rows" })
    ).toBeVisible()

    // ...the deep-linked page survives...
    expect(shellState()).toMatchObject({ page: 2 })
    expect(screen.getByTestId("location-search")).toHaveTextContent("page=2")

    // ...and the committed filter is intact in both the URL and the request.
    expect(screen.getByTestId("location-search")).toHaveTextContent("q=release")
    expect(listCalls.at(-1)).toMatchObject({
      filters: [{ field: "q", operator: "contains", value: "release" }],
      pagination: { currentPage: 2 },
    })
  })
})

describe("escape hatch 3: feature-owned overlays", () => {
  it("coexists with the imperative-ref + ConfirmDialog pattern", async () => {
    const user = userEvent.setup()
    renderHarness({ overlay: "ref" })

    await screen.findByRole("cell", { name: "Alpha" })
    await user.click(screen.getAllByRole("button", { name: "Open overlay" })[0])

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Delete Alpha")
    await user.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() =>
      expect(shellState()).toMatchObject({ confirmed: ["confirmed"] })
    )
  })

  it("coexists with the useDialog + lazy overlay pattern", async () => {
    const user = userEvent.setup()
    renderHarness({ overlay: "dialog" })

    await screen.findByRole("cell", { name: "Alpha" })
    await user.click(screen.getAllByRole("button", { name: "Open overlay" })[0])

    const dialog = await screen.findByRole("dialog", { name: "Edit task" })
    expect(dialog).toHaveTextContent("Alpha")
    await user.click(screen.getByRole("button", { name: "Close overlay" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit task" })).toBeNull()
    )
  })

  it("exposes refineCore and reactTable so features keep control", async () => {
    const user = userEvent.setup()
    const { listCalls } = renderHarness({ overlay: "ref" })

    await screen.findByRole("cell", { name: "Alpha" })
    expect(shellState()).toMatchObject({ page: 1, pageCount: 1, total: 3 })

    const before = listCalls.length
    await user.click(
      screen.getByRole("button", { name: "Refetch via refineCore" })
    )
    await waitFor(() => expect(listCalls.length).toBeGreaterThan(before))
  })
})

describe("escape hatch 4: feature-supplied skeleton widths", () => {
  it("honours the per-feature widths and the active page size", async () => {
    let resolveRows!: (result: { data: ProbeRow[]; total: number }) => void
    const pending = new Promise<{ data: ProbeRow[]; total: number }>(
      (resolve) => {
        resolveRows = resolve
      }
    )
    const { container } = renderHarness({ rows: () => pending })

    expect(screen.getByText("Loading probes…")).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-slot="table-skeleton-row"]')
    ).toHaveLength(30)
    expect(skeletonWidths(container)).toEqual([40, 220, 100])

    resolveRows({ data: ROWS, total: ROWS.length })
    expect(await screen.findByRole("cell", { name: "Alpha" })).toBeVisible()
  })
})

function scrollElement(container: HTMLElement): HTMLElement {
  const element = container.querySelector('[data-slot="table-scroll"]')
  if (!(element instanceof HTMLElement)) {
    throw new Error("table scroll element was not rendered")
  }
  return element
}

describe("fitted table shell", () => {
  it("keeps the grid and pagination in one flexible column", async () => {
    const { container } = renderHarness({
      rows: () => Promise.resolve({ data: ROWS, total: 90 }),
    })

    await screen.findByRole("cell", { name: "Alpha" })

    const shell = container.querySelector('[data-slot="table-shell"]')
    expect(shell).not.toBeNull()
    expect(shell).toHaveClass("flex", "min-h-0", "flex-1", "flex-col")

    const region = shell?.querySelector('[data-slot="table-region"]')
    expect(region).toHaveClass("flex", "min-h-[240px]", "flex-1", "flex-col")
    expect(region?.querySelector('[data-slot="table-scroll"]')).not.toBeNull()

    const footer = shell?.querySelector('[data-slot="table-footer"]')
    expect(footer).toHaveClass("shrink-0")
    expect(footer).toContainElement(
      screen.getByRole("navigation", { name: "Pagination" })
    )
  })

  it("makes the header cells sticky above the body", async () => {
    renderHarness()

    const header = await screen.findByRole("columnheader", { name: "Name" })
    expect(header).toHaveClass("sticky", "top-0", "z-10")
  })

  it("resets the body scroll only when the list state changes", async () => {
    const user = userEvent.setup()
    const { container, listCalls } = renderHarness({
      rows: () => Promise.resolve({ data: ROWS, total: 90 }),
    })

    await screen.findByRole("cell", { name: "Alpha" })
    const scroller = scrollElement(container)

    // Selection, a bulk-bar-clearing clear, gated columns, and a refetch do
    // not change the page/filter/sort signature, so the body stays put.
    scroller.scrollTop = 140
    await user.click(screen.getByRole("checkbox", { name: "Select Alpha" }))
    await waitFor(() =>
      expect(shellState()).toMatchObject({ selected: ["one"] })
    )
    expect(scroller.scrollTop).toBe(140)

    await user.click(screen.getByRole("button", { name: "Clear selection" }))
    expect(scroller.scrollTop).toBe(140)

    await user.click(screen.getByRole("button", { name: "Show gated columns" }))
    expect(scroller.scrollTop).toBe(140)

    const callsBeforeRefetch = listCalls.length
    await user.click(
      screen.getByRole("button", { name: "Refetch via refineCore" })
    )
    await waitFor(() =>
      expect(listCalls.length).toBeGreaterThan(callsBeforeRefetch)
    )
    expect(scroller.scrollTop).toBe(140)

    // Each of page, page size, filter, and sort is a new list state and
    // returns the body to the top.
    const listStateChanges = [
      () => user.click(screen.getByRole("button", { name: "Go to page 2" })),
      () =>
        user.click(
          screen.getByRole("button", { name: "Change to 10 per page" })
        ),
      () =>
        user.click(
          screen.getByRole("button", { name: "Commit search filter" })
        ),
      () => user.click(screen.getByRole("button", { name: "Name" })),
    ]

    for (const change of listStateChanges) {
      scroller.scrollTop = 140
      expect(scroller.scrollTop).toBe(140)
      await change()
      await waitFor(() => expect(scroller.scrollTop).toBe(0))
    }
  })

  it("fills the grid region with the skeleton while loading", () => {
    const { container } = renderHarness({ rows: () => new Promise(() => {}) })

    const shell = container.querySelector('[data-slot="table-shell"]')
    expect(shell).not.toBeNull()
    expect(shell).toHaveAttribute("data-state", "loading")
    expect(shell).toHaveClass("flex", "min-h-0", "flex-1", "flex-col")

    const grid = container.querySelector('[data-slot="table-skeleton"]')
    expect(grid).toHaveClass("min-h-[240px]", "flex-1", "overflow-hidden")

    const footer = container.querySelector(
      '[data-slot="table-skeleton-footer"]'
    )
    expect(footer).toHaveClass("shrink-0")
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull()
  })

  it("shows the error state in the grid region without pagination", async () => {
    const { container } = renderHarness({
      rows: () => Promise.reject(new Error("probe failed")),
    })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load probes."
    )
    const shell = container.querySelector('[data-slot="table-shell"]')
    expect(shell).toHaveAttribute("data-state", "error")
    expect(shell).toHaveClass("flex", "min-h-0", "flex-1", "flex-col")
    expect(
      shell
        ?.querySelector('[data-slot="table-region"]')
        ?.querySelector('[role="alert"]')
    ).not.toBeNull()
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull()
  })

  it("shows the empty state in the grid region without pagination", async () => {
    const { container } = renderHarness({
      rows: () => Promise.resolve({ data: [], total: 0 }),
    })

    expect(await screen.findByText("Nothing here yet.")).toBeVisible()
    const shell = container.querySelector('[data-slot="table-shell"]')
    expect(shell).toHaveAttribute("data-state", "empty")
    expect(shell).toHaveClass("flex", "min-h-0", "flex-1", "flex-col")
    expect(
      shell?.querySelector('[data-slot="table-region"]')
    ).toHaveTextContent("Nothing here yet.")
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull()
  })
})

function dataRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('tbody tr[data-slot="table-row"]')
  )
}

/** Data rows form a contiguous zero-based index space below the header row. */
function expectContiguousRowIndexes(container: HTMLElement) {
  dataRows(container).forEach((row, index) => {
    expect(row).toHaveAttribute("data-index", String(index))
    expect(row).toHaveAttribute("aria-rowindex", String(index + 2))
  })
}

describe("logical row identity", () => {
  it("exposes the page row count and each data row's index", async () => {
    const { container } = renderHarness()

    await screen.findByRole("cell", { name: "Alpha" })

    // The logical count is independent of what is mounted; the accessible
    // total adds the header row.
    expect(scrollElement(container)).toHaveAttribute("data-row-count", "3")
    expect(container.querySelector('[data-slot="table"]')).toHaveAttribute(
      "aria-rowcount",
      "4"
    )
    expect(dataRows(container)).toHaveLength(3)
    expectContiguousRowIndexes(container)
  })

  it("keeps indexes contiguous across sorting and paging", async () => {
    const user = userEvent.setup()
    const { container } = renderHarness({
      rows: () => Promise.resolve({ data: ROWS, total: 90 }),
    })

    await screen.findByRole("cell", { name: "Alpha" })
    expectContiguousRowIndexes(container)

    // Sorting reorders the page row model without changing its index space.
    await user.click(screen.getByRole("button", { name: "Name" }))
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "order=desc"
      )
    )
    expect(scrollElement(container)).toHaveAttribute("data-row-count", "3")
    expectContiguousRowIndexes(container)

    // Paging replaces the page's rows; indexes still restart at zero.
    await user.click(screen.getByRole("button", { name: "Go to page 2" }))
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("page=2")
    )
    expect(scrollElement(container)).toHaveAttribute("data-row-count", "3")
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "4")
    expectContiguousRowIndexes(container)
  })
})

function spacerRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'tbody tr[data-slot="table-spacer-row"]'
    )
  )
}

/** Put the fitted body at the offset that reveals the last logical row. */
function scrollToEnd(scroller: HTMLElement, logicalRows: number) {
  // The jsdom shim measures every row at 36px, so the body's full height is
  // predictable without reading the virtualizer's internals.
  scroller.scrollTop = logicalRows * 36 - scroller.clientHeight
  fireEvent.scroll(scroller)
}

describe("virtualized fitted body", () => {
  async function renderBigPage() {
    const result = renderHarness({
      rows: () => Promise.resolve({ data: BIG_ROWS, total: BIG_ROWS.length }),
    })
    await screen.findByRole("cell", { name: "Probe 01" })
    return { ...result, scroller: scrollElement(result.container) }
  }

  it("mounts only the rows near the viewport and reveals late rows on scroll", async () => {
    const { container, scroller } = await renderBigPage()

    expect(scroller).toHaveAttribute("data-row-count", "80")
    // Mounted rows are fewer than the logical page; the last row is not yet
    // in the DOM.
    expect(dataRows(container).length).toBeGreaterThan(0)
    expect(dataRows(container).length).toBeLessThan(80)
    expect(screen.queryByRole("cell", { name: "Probe 80" })).toBeNull()

    scrollToEnd(scroller, 80)

    expect(await screen.findByRole("cell", { name: "Probe 80" })).toBeVisible()
    // Scrolling windows the body rather than mounting the whole page.
    expect(dataRows(container).length).toBeLessThan(80)
  })

  it("frames the mounted window with hidden, empty spacer rows", async () => {
    const { container } = await renderBigPage()

    const spacers = spacerRows(container)
    expect(spacers).toHaveLength(2)
    for (const spacer of spacers) {
      expect(spacer).toHaveAttribute("aria-hidden", "true")
      expect(spacer).toHaveAttribute("role", "none")
      expect(spacer.textContent).toBe("")
    }

    // The top spacer sits before the first mounted row and the bottom spacer
    // after the last, so the body's scroll height covers every logical row.
    const rowsInBody = Array.from(
      container.querySelectorAll("tbody > tr")
    ) as HTMLElement[]
    expect(rowsInBody[0]).toBe(spacers[0])
    expect(rowsInBody.at(-1)).toBe(spacers[1])
  })

  it("keeps aria-rowcount and each mounted row's aria-rowindex correct", async () => {
    const { container, scroller } = await renderBigPage()

    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "81")
    dataRows(container).forEach((row) => {
      const index = Number(row.getAttribute("data-index"))
      expect(row).toHaveAttribute("aria-rowindex", String(index + 2))
    })

    scrollToEnd(scroller, 80)
    await screen.findByRole("cell", { name: "Probe 80" })

    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "81")
    dataRows(container).forEach((row) => {
      const index = Number(row.getAttribute("data-index"))
      expect(row).toHaveAttribute("aria-rowindex", String(index + 2))
    })
    expect(
      dataRows(container).some((row) => row.getAttribute("data-index") === "79")
    ).toBe(true)
  })

  it("selects every page row, including unmounted rows, and reflects it on remount", async () => {
    const user = userEvent.setup()
    const { scroller } = await renderBigPage()

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }))

    // Page-scoped selection covers the row model, not the mounted window.
    await waitFor(() =>
      expect(shellState()).toMatchObject({
        selected: BIG_ROWS.map((row) => row.id),
      })
    )

    scrollToEnd(scroller, 80)
    const lateRow = await screen.findByRole("checkbox", {
      name: "Select Probe 80",
    })
    await waitFor(() => expect(lateRow).toBeChecked())
  })

  it("returns the virtualized body to the top when the list state changes", async () => {
    const user = userEvent.setup()
    const { scroller } = await renderBigPage()

    scrollToEnd(scroller, 80)
    await screen.findByRole("cell", { name: "Probe 80" })
    expect(scroller.scrollTop).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Go to page 2" }))
    await waitFor(() => expect(scroller.scrollTop).toBe(0))

    scrollToEnd(scroller, 80)
    await screen.findByRole("cell", { name: "Probe 80" })
    await user.click(
      screen.getByRole("button", { name: "Change to 10 per page" })
    )
    await waitFor(() => expect(scroller.scrollTop).toBe(0))
  })

  it("does not reset the virtualized body for selection or a refetch", async () => {
    const user = userEvent.setup()
    const { scroller } = await renderBigPage()

    scrollToEnd(scroller, 80)
    await screen.findByRole("cell", { name: "Probe 80" })
    const scrolledTo = scroller.scrollTop
    expect(scrolledTo).toBeGreaterThan(0)

    await user.click(screen.getByRole("checkbox", { name: "Select Probe 79" }))
    expect(scroller.scrollTop).toBe(scrolledTo)

    await user.click(
      screen.getByRole("button", { name: "Refetch via refineCore" })
    )
    await waitFor(() => expect(scroller.scrollTop).toBe(scrolledTo))
  })
})

describe("escape hatch 5: feature-supplied empty state", () => {
  it("renders the title, description, and action the feature supplies", async () => {
    const action = vi.fn()
    renderHarness({
      rows: () => Promise.resolve({ data: [], total: 0 }),
      empty: {
        title: "No probes yet.",
        description: "Create one to get started.",
        action: { label: "Create probe", onClick: action },
      },
    })

    expect(await screen.findByText("No probes yet.")).toBeVisible()
    expect(screen.getByText("Create one to get started.")).toBeVisible()
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create probe" }))
    expect(action).toHaveBeenCalledOnce()
  })

  it("supports a no-match variant with only a title", async () => {
    renderHarness({
      rows: () => Promise.resolve({ data: [], total: 0 }),
      empty: { title: "No probes match your filters." },
    })

    expect(
      await screen.findByText("No probes match your filters.")
    ).toBeVisible()
    expect(screen.queryByRole("button", { name: "Create probe" })).toBeNull()
  })
})
