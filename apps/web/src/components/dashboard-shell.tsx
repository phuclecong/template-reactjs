import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { AppSidebar } from "@/components/app-sidebar"
import type { DashboardUser } from "@/providers/auth-provider"

/**
 * Route segment → translation key, used to label breadcrumb crumbs for the
 * known `/dashboard/*` pages. Unknown segments fall back to the raw slug.
 */
const SEGMENT_LABELS: Record<string, string> = {
  tasks: "shell.nav.tasks",
  users: "shell.nav.users",
  settings: "shell.nav.settings",
}

const SIDEBAR_COOKIE_NAME = "sidebar_state"

/**
 * The registry `SidebarProvider` persists the collapsed rail to the
 * `sidebar_state` cookie but never reads it. This SPA has no server layout to
 * hydrate the initial state, so the app shell restores it here and passes it
 * in as `defaultOpen` (ADR-0009 keeps the vendored file unedited).
 */
function readSidebarCookie(fallback: boolean): boolean {
  if (typeof document === "undefined") return fallback
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`)
  )
  return match ? match[1] === "true" : fallback
}

/**
 * Client shell for every `/dashboard/*` route: a collapsible sidebar (icon
 * rail on desktop, Sheet drawer on mobile) plus a content inset with a sticky
 * header. The shell is the app-owned seam that restores the persisted sidebar
 * state; the registry provider only writes the cookie.
 */
export function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // Read once on mount so later toggles (which write the cookie) do not
  // overwrite the provider's internal state.
  const [defaultOpen] = React.useState(() => readSidebarCookie(true))

  // Everything after the leading "dashboard" segment, e.g. ["tasks"].
  const routeSegments = (pathname ?? "").split("/").filter(Boolean).slice(1)

  const crumbs = [
    {
      href: "/dashboard/tasks",
      label: t("shell.title"),
      isCurrent: routeSegments.length === 0,
    },
    ...routeSegments.map((segment, index) => ({
      href: `/dashboard/${routeSegments.slice(0, index + 1).join("/")}`,
      label: t(SEGMENT_LABELS[segment] ?? segment),
      isCurrent: index === routeSegments.length - 1,
    })),
  ]

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={user} collapsible="icon" />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-muted/90 bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                  <React.Fragment key={`${crumb.href}-${index}`}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.isCurrent ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link to={crumb.href} />}>
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
