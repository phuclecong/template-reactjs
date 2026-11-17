import { useTranslation } from "react-i18next"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { paginationItems } from "@workspace/ui/lib/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { paginationEdgeProps } from "../utils"

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100]

export type TablePaginationProps = {
  page: number
  pageSize: number
  pageCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /**
   * Optional translated summary rendered before the page-size control, for
   * example "60 roles". Omit it for tables that show no total.
   */
  summary?: string
}

/**
 * Table footer with the page-size control and page links. It takes only the
 * current pagination state and callbacks, so server-paged tables share one
 * footer whether the state comes from `useTableState` or Refine.
 */
export function TablePagination({
  page,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  summary,
}: TablePaginationProps) {
  const { t } = useTranslation()
  const isFirstPage = page <= 1
  const isLastPage = page >= pageCount

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {summary ? (
          <span className="text-xs text-muted-foreground">{summary}</span>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("table.pagination.rowsPerPage")}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value) || 30)}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("table.pagination.rowsPerPage")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pageCount > 1 && (
        <Pagination
          aria-label={t("table.pagination.label")}
          className="flex-1 justify-end"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                text=""
                aria-label={t("table.pagination.prev")}
                {...paginationEdgeProps(isFirstPage, () =>
                  onPageChange(page - 1)
                )}
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
                    aria-label={t("table.pagination.pageLabel").replace(
                      "{page}",
                      String(item)
                    )}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                text=""
                aria-label={t("table.pagination.next")}
                {...paginationEdgeProps(isLastPage, () =>
                  onPageChange(page + 1)
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
