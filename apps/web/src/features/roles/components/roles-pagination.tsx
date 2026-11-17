import { useTranslation } from "react-i18next"
import { paginationEdgeProps } from "@workspace/shared-lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { paginationItems } from "@workspace/ui/lib/pagination"

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100]

/**
 * Roles footer: total, page-size control, and page links. It renders the
 * Refine/`useTable` state supplied by the table; later tickets can add bulk
 * controls above it without touching this component.
 */
export function RolesPagination({
  page,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const { t } = useTranslation()
  const isFirstPage = page <= 1
  const isLastPage = page >= pageCount

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {t("roles.total", { total })}
        </span>
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
