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
  paginationItems,
} from "./pagination"

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
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
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
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
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
      canvas.getByRole("button", { name: "Previous page" })
    ).toBeDisabled()
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

    await userEvent.click(canvas.getByRole("button", { name: "Next page" }))
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
      canvas.getByRole("button", { name: "Next page" })
    ).toBeDisabled()
  },
}

export const SinglePage: Story = {
  render: () => <PaginationDemo pageCount={1} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole("button", { name: "Previous page" })
    ).toBeDisabled()
    await expect(
      canvas.getByRole("button", { name: "Next page" })
    ).toBeDisabled()
  },
}
