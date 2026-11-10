import { Refine } from "@refinedev/core"
import routerProvider from "@refinedev/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Toaster } from "@workspace/ui/components/sonner"

import { authProvider } from "@/providers/auth-provider"
import { accessControlProvider } from "@/providers/access-control-provider"
import { auditLogProvider } from "@/providers/audit-log-provider"
import { dataProvider } from "@/providers/data-provider"
import { i18nProvider } from "@/providers/i18n-provider"
import { notificationProvider } from "@/providers/notification-provider"
import { MswGate } from "@/components/msw-provider"
import { applyPersistedLocale } from "@/utils/i18n"

/**
 * Single Refine backbone (ADR-0002): every cross-cutting provider is wired
 * here — data, auth, access-control, notifications, i18n, and audit-log. Routes
 * render as children inside `<Refine>` so the hooks resolve their context.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  // No real backend URL → run against the in-browser mock worker.
  const mockMode = !import.meta.env.VITE_API_URL

  useEffect(() => {
    applyPersistedLocale()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Refine
        routerProvider={routerProvider}
        dataProvider={dataProvider}
        authProvider={authProvider}
        accessControlProvider={accessControlProvider}
        notificationProvider={notificationProvider}
        i18nProvider={i18nProvider}
        auditLogProvider={auditLogProvider}
        options={{ syncWithLocation: true, disableTelemetry: true }}
      >
        <MswGate mockMode={mockMode}>{children}</MswGate>
      </Refine>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}
