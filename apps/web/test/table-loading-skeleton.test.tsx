// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import type { ColumnDef } from "@tanstack/react-table"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import { DataTable } from "@workspace/shared-lib/components"

type Row = { id: string; title: string }

const columns: ColumnDef<Row>[] = [
  { accessorKey: "title", header: "Title", size: 360 },
  { id: "status", header: "Status", size: 120 },
  { id: "actions", header: "Actions", size: 140 },
]

const pagination = {
  page: 1,
  pageSize: 30,
  pageCount: 5,
  onPageChange: () => {},
  onPageSizeChange: () => {},
}

function renderLoadingTable() {
  return render(
    <I18nextProvider i18n={i18n}>
      <DataTable<Row>
        data={[]}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={() => {}}
        rowSelection={{}}
        onRowSelectionChange={() => {}}
        isLoading
        loadingLabel="Loading tasks…"
        emptyLabel="No tasks yet."
        pagination={pagination}
      />
    </I18nextProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

describe("DataTable loading state", () => {
  it("announces loading without exposing fake table or pagination semantics", () => {
    renderLoadingTable()

    expect(screen.getByRole("status")).toHaveTextContent("Loading tasks…")
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByRole("columnheader")).toBeNull()
    expect(
      screen.queryByRole("navigation", { name: "Pagination" })
    ).toBeNull()
    expect(
      screen.queryByRole("combobox", { name: "Rows per page" })
    ).toBeNull()
  })

  it("reserves the page size and the real column widths", () => {
    const { container } = renderLoadingTable()

    const rows = container.querySelectorAll('[data-slot="table-skeleton-row"]')
    expect(rows).toHaveLength(30)

    const firstRowCells = rows[0].querySelectorAll(
      '[data-slot="table-skeleton-cell"]'
    )
    expect(
      Array.from(firstRowCells).map((cell) =>
        Number((cell as HTMLElement).style.width.replace("px", ""))
      )
    ).toEqual([360, 120, 140])
  })
})
