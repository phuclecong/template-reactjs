import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Badge } from "./badge"

/**
 * Status vocabulary shared by records with an `active` / `inactive`
 * lifecycle. The registry `Badge` is vendored verbatim (ADR-0009), so the
 * semantic colours live here as a repo-owned composition: green for active,
 * grey for inactive.
 */
const statusBadgeVariants = cva("border-transparent", {
  variants: {
    status: {
      active:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      inactive: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: {
    status: "active",
  },
})

function StatusBadge({
  className,
  status = "active",
  ...props
}: React.ComponentProps<typeof Badge> &
  VariantProps<typeof statusBadgeVariants>) {
  return (
    <Badge
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    />
  )
}

export { StatusBadge, statusBadgeVariants }
