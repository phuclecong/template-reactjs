import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination"
import { paginationItems } from "../lib/pagination"

function PaginationDemo({
  pageCount = 5,
  initialPage = 1,
}: {
  pageCount?: number
  initialPage?: number
}) {
  const [page, setPage] = useState(initialPage)

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={page <= 1 || undefined}
            tabIndex={page <= 1 ? -1 : undefined}
            onClick={
              page <= 1 ? undefined : () => setPage((current) => current - 1)
            }
          />
        </PaginationItem>
        {paginationItems(page, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                isActive={item === page}
                aria-label={`Page ${item}`}
                onClick={() => setPage(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            aria-disabled={page >= pageCount || undefined}
            tabIndex={page >= pageCount ? -1 : undefined}
            onClick={
              page >= pageCount
                ? undefined
                : () => setPage((current) => current + 1)
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

const meta = {
  title: "Primitives/Pagination",
  component: Pagination,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <PaginationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Go to previous page" })
    ).toHaveAttribute("aria-disabled", "true")
    await expect(
      canvas.getByRole("button", { name: "Page 1" })
    ).toHaveAttribute("aria-current", "page")

    await userEvent.click(canvas.getByRole("button", { name: "Page 2" }))
    await expect(
      canvas.getByRole("button", { name: "Page 2" })
    ).toHaveAttribute("aria-current", "page")
    await expect(
      canvas.getByRole("button", { name: "Page 1" })
    ).not.toHaveAttribute("aria-current")

    await userEvent.click(
      canvas.getByRole("button", { name: "Go to next page" })
    )
    await expect(
      canvas.getByRole("button", { name: "Page 3" })
    ).toHaveAttribute("aria-current", "page")
  },
}

export const WithEllipsis: Story = {
  render: () => <PaginationDemo pageCount={20} initialPage={10} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Page 10" })
    ).toHaveAttribute("aria-current", "page")

    await userEvent.click(canvas.getByRole("button", { name: "Page 20" }))
    await expect(
      canvas.getByRole("button", { name: "Page 20" })
    ).toHaveAttribute("aria-current", "page")
    await expect(
      canvas.getByRole("button", { name: "Go to next page" })
    ).toHaveAttribute("aria-disabled", "true")
  },
}

export const SinglePage: Story = {
  render: () => <PaginationDemo pageCount={1} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Go to previous page" })
    ).toHaveAttribute("aria-disabled", "true")
    await expect(
      canvas.getByRole("button", { name: "Go to next page" })
    ).toHaveAttribute("aria-disabled", "true")
  },
}
