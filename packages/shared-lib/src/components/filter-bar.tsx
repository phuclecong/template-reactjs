import { useState, type ReactNode } from "react"
import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"

export type FilterBarProps = {
  /** Translated accessible name for the controls group, e.g. "Task filters". */
  label: string
  /** Translated toggle label, e.g. "Filters". */
  toggleLabel: string
  /** Applied-filter count shown next to the label; 0 hides the badge. */
  activeCount?: number
  /** Extra controls for the toggle row, for example a Clear action. */
  actions?: ReactNode
  /**
   * The filter controls. They stack full width below the toggle on small
   * screens and flow inline from the `sm` breakpoint up.
   */
  children: ReactNode
  /**
   * Applied-filter chips. They stay visible while the controls are collapsed,
   * so the current filter state never disappears with the controls.
   */
  footer?: ReactNode
}

/**
 * Collapsible, responsive shell for a list screen's filter controls.
 *
 * Controls expand by default on larger screens and start collapsed on small
 * ones, so the table keeps most of the viewport. Both states are user-toggleable;
 * a count badge plus the always-visible chips keep the applied filters
 * discoverable while the controls are hidden.
 */
export function FilterBar({
  label,
  toggleLabel,
  activeCount = 0,
  actions,
  children,
  footer,
}: FilterBarProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(!isMobile)
  const [lastIsMobile, setLastIsMobile] = useState(isMobile)

  // Crossing the breakpoint re-applies the default for that size. A resize is
  // an external change; the previous explicit choice is not carried over.
  if (isMobile !== lastIsMobile) {
    setLastIsMobile(isMobile)
    setOpen(!isMobile)
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpen(next)}
      className="group/filter-bar flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" size="sm" />}
        >
          <SlidersHorizontalIcon />
          {toggleLabel}
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1.5 text-[0.65rem] tabular-nums"
            >
              {activeCount}
            </Badge>
          )}
          <ChevronDownIcon className="transition-transform group-data-open/filter-bar:rotate-180" />
        </CollapsibleTrigger>

        <CollapsibleContent
          role="group"
          aria-label={label}
          className="order-last flex w-full flex-col gap-2 sm:order-none sm:w-auto sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center"
        >
          {children}
        </CollapsibleContent>

        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {footer}
    </Collapsible>
  )
}
