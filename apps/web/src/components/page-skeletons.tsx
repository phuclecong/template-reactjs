import { useTranslation } from "react-i18next"
import { TablePageLayout } from "@workspace/shared-lib/components/table-page-layout"
import { TableSkeleton } from "@workspace/shared-lib/components/table-skeleton"
import { DEFAULT_PAGE_SIZE } from "@workspace/shared-lib/hooks/table-defaults"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ROLE_SKELETON_COLUMN_WIDTHS } from "@/features/roles/utils/column-widths"
import { TASK_SKELETON_COLUMN_WIDTHS } from "@/features/tasks/utils/column-widths"
import { USER_SKELETON_COLUMN_WIDTHS } from "@/features/users/utils/column-widths"

/**
 * Page-shaped loading surfaces. They reserve the layout the real screen will
 * occupy and announce loading through a visually hidden `role="status"` region,
 * but never render protected identity/task/user data or fake table, sort, and
 * pagination semantics that could race the e2e assertions.
 *
 * Dimensions use inline styles rather than one-off Tailwind utilities so the
 * skeleton adds no CSS to the render-blocking stylesheet.
 */

type BarProps = {
  height: number
  width: number
}

function Bar({ height, width }: BarProps) {
  return <Skeleton style={{ height, width }} />
}

function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <div role="status" className="sr-only">
      {label}
    </div>
  )
}

/** Centered card matching the login/register form, used while auth resolves. */
export function AuthPageSkeleton() {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div
        className="flex w-full max-w-sm flex-col gap-4 text-sm"
        aria-hidden="true"
      >
        <Bar height={28} width={128} />
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <Bar height={16} width={64} />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-full" />
        <Bar height={16} width={240} />
        <Skeleton style={{ height: 80 }} className="w-full" />
      </div>
      <LoadingAnnouncement label={t("common.loading")} />
    </main>
  )
}

/**
 * Neutral app-shell frame shown while `ProtectedRoute`/`AppShellLayout` run
 * their async checks. It mirrors the shell dimensions (sidebar rail + sticky
 * header) without a User, navigation, or any protected content.
 */
export function AppShellSkeleton() {
  const { t } = useTranslation()

  return (
    <div className="flex h-svh w-full overflow-hidden">
      <div
        className="hidden w-64 shrink-0 border-sidebar-border bg-sidebar md:block"
        style={{ borderRightWidth: 1 }}
        aria-hidden="true"
      >
        <div className="flex flex-col gap-4 p-4">
          <Bar height={28} width={112} />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-muted/90 bg-background px-4">
          <Skeleton style={{ height: 24, width: 24 }} aria-hidden="true" />
          <Bar height={16} width={160} />
        </header>
        <div
          data-slot="shell-content"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex min-h-full flex-col gap-4 p-6 text-sm">
            <div
              className="flex flex-wrap items-center gap-2"
              aria-hidden="true"
            >
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-8 w-56" />
            </div>
            <Skeleton className="h-8 w-full" aria-hidden="true" />
            <Skeleton style={{ height: 160 }} className="w-full" />
          </div>
        </div>
      </main>
      <LoadingAnnouncement label={t("common.loading")} />
    </div>
  )
}

/** Dashboard shape: header, four KPI cards, two charts, and the assignee chart. */
export function DashboardPageSkeleton() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6 p-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Bar height={28} width={128} />
        <Skeleton style={{ height: 22, width: 88 }} />
      </div>
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} style={{ height: 88 }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <Skeleton style={{ height: 320 }} />
        <Skeleton style={{ height: 320 }} />
      </div>
      <Skeleton style={{ height: 320 }} aria-hidden="true" />
      <LoadingAnnouncement label={t("dashboard.loading")} />
    </div>
  )
}

/** Per-route table shape and loading copy for `TablePageSkeleton`. */
const TABLE_PAGE_DETAILS = {
  tasks: {
    columnWidths: TASK_SKELETON_COLUMN_WIDTHS,
    loadingKey: "tasks.loading",
  },
  users: {
    columnWidths: USER_SKELETON_COLUMN_WIDTHS,
    loadingKey: "users.loading",
  },
  roles: {
    columnWidths: ROLE_SKELETON_COLUMN_WIDTHS,
    loadingKey: "roles.loading",
  },
} as const

/** Table page skeleton for the Tasks, Users, and Roles route chunks. */
export function TablePageSkeleton({
  kind,
}: {
  kind: keyof typeof TABLE_PAGE_DETAILS
}) {
  const { t } = useTranslation()
  const isRoles = kind === "roles"
  const hasTitleBar = kind === "roles" || kind === "tasks"
  const { columnWidths, loadingKey } = TABLE_PAGE_DETAILS[kind]
  const loadingLabel = t(loadingKey)

  return (
    <TablePageLayout>
      {hasTitleBar ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          aria-hidden="true"
        >
          <Bar height={28} width={96} />
          <Bar height={32} width={120} />
        </div>
      ) : null}
      {isRoles ? null : (
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-48" />
        </div>
      )}
      <TableSkeleton
        columnWidths={columnWidths}
        rowCount={DEFAULT_PAGE_SIZE}
        label={loadingLabel}
      />
    </TablePageLayout>
  )
}

/** Form-shaped skeleton for the Settings route chunk. */
export function SettingsPageSkeleton() {
  const { t } = useTranslation()

  return (
    <div className="flex max-w-lg flex-col gap-8 p-6 text-sm">
      <Bar height={28} width={128} />
      {[0, 1, 2].map((section) => (
        <div key={section} className="flex flex-col gap-2" aria-hidden="true">
          <Bar height={20} width={96} />
          <div className="flex gap-2">
            <Bar height={32} width={80} />
            <Bar height={32} width={80} />
            <Bar height={32} width={80} />
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Bar height={20} width={144} />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Bar height={32} width={144} />
      </div>
      <LoadingAnnouncement label={t("common.loading")} />
    </div>
  )
}
