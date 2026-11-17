import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { RetryableLazy } from "@/components/retryable-lazy"
import { ThemeProvider } from "@/components/theme-provider"
import {
  AuthPageSkeleton,
  SettingsPageSkeleton,
  TablePageSkeleton,
} from "@/components/page-skeletons"
import { Providers } from "@/providers"
import { ProtectedRoute, RedirectIfAuthed } from "@/routes/protected-route"
import { DashboardLayout } from "@/routes/dashboard-layout"
import { routeLoaders, type RoutePath } from "@/routes/route-loaders"

// Route views are split out of the entry chunk. `routeLoaders` is also used by
// sidebar/breadcrumb intent prefetching, so both paths share one import. Each
// route owns a chunk error boundary so a failed import offers a retry instead
// of blanking the shell. The guards, shell, providers, and this component stay
// eager.
function LazyRoute({
  path,
  fallback,
}: {
  path: RoutePath
  fallback: ReactNode
}) {
  return (
    <RetryableLazy
      // A route change reuses this component position; the key makes React
      // mount a fresh lazy component instead of keeping the previous route.
      key={path}
      loader={routeLoaders[path]}
      props={{}}
      fallback={fallback}
    />
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Providers>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard/tasks"
              element={<Navigate to="/tasks" replace />}
            />
            <Route
              path="/dashboard/users"
              element={<Navigate to="/users" replace />}
            />
            <Route
              path="/dashboard/roles"
              element={<Navigate to="/roles" replace />}
            />
            <Route
              path="/dashboard/settings"
              element={<Navigate to="/settings" replace />}
            />

            <Route element={<RedirectIfAuthed />}>
              <Route
                path="/login"
                element={
                  <LazyRoute path="/login" fallback={<AuthPageSkeleton />} />
                }
              />
              <Route
                path="/register"
                element={
                  <LazyRoute path="/register" fallback={<AuthPageSkeleton />} />
                }
              />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route
                  path="/dashboard"
                  element={<LazyRoute path="/dashboard" fallback={null} />}
                />
                <Route
                  path="/tasks"
                  element={
                    <LazyRoute
                      path="/tasks"
                      fallback={<TablePageSkeleton kind="tasks" />}
                    />
                  }
                />
                <Route
                  path="/users"
                  element={
                    <LazyRoute
                      path="/users"
                      fallback={<TablePageSkeleton kind="users" />}
                    />
                  }
                />
                <Route
                  path="/roles"
                  element={
                    <LazyRoute
                      path="/roles"
                      fallback={<TablePageSkeleton kind="roles" />}
                    />
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <LazyRoute
                      path="/settings"
                      fallback={<SettingsPageSkeleton />}
                    />
                  }
                />
              </Route>
            </Route>
          </Routes>
        </Providers>
      </ThemeProvider>
    </BrowserRouter>
  )
}
