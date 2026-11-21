import type { LiveStatus } from "@/providers/live-provider"
import { useTranslation } from "react-i18next"

const LABEL_KEYS = {
  offline: "dashboard.live.offline",
  connecting: "dashboard.live.connecting",
  reconnecting: "dashboard.live.reconnecting",
  live: "dashboard.live.live",
} as const

const DOT_CLASSES: Record<LiveStatus, string> = {
  offline: "bg-muted-foreground",
  connecting: "bg-amber-500 animate-pulse motion-reduce:animate-none",
  reconnecting: "bg-amber-500 animate-pulse motion-reduce:animate-none",
  live: "bg-emerald-500",
}

/** The simulator runs only when the in-browser mock is active and not opted out. */
function isDemoActivity(): boolean {
  return (
    !import.meta.env.VITE_API_URL &&
    import.meta.env.VITE_MOCK_LIVE_ACTIVITY !== "false"
  )
}

export function DashboardHeader({ liveStatus }: { liveStatus: LiveStatus }) {
  const { t } = useTranslation()
  const label =
    liveStatus === "live" && isDemoActivity()
      ? t("dashboard.live.demo")
      : t(LABEL_KEYS[liveStatus])

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg font-medium">{t("dashboard.title")}</h1>
      <div
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${DOT_CLASSES[liveStatus]}`}
        />
        {label}
      </div>
    </div>
  )
}
