import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import {
  AuthPageSkeleton,
  SettingsPageSkeleton,
  TablePageSkeleton,
} from "@/components/page-skeletons"
import { Providers } from "@/providers"
import { ProtectedRoute, RedirectIfAuthed } from "@/routes/protected-route"
import { DashboardLayout } from "@/routes/dashboard-layout"
import { routeLoaders } from "@/routes/route-loaders"

// Route views are split out of the entry chunk. `routeLoaders` is also used by
// sidebar/breadcrumb intent prefetching, so both paths share one import. The
// guards, shell, providers, and this component stay eager.
const LoginPage = lazy(routeLoaders["/login"])
const RegisterPage = lazy(routeLoaders["/register"])
const TasksPage = lazy(routeLoaders["/dashboard/tasks"])
const UsersPage = lazy(routeLoaders["/dashboard/users"])
const SettingsPage = lazy(routeLoaders["/dashboard/settings"])

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Providers>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<RedirectIfAuthed />}>
              <Route
                path="/login"
                element={
                  <Suspense fallback={<AuthPageSkeleton />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route
                path="/register"
                element={
                  <Suspense fallback={<AuthPageSkeleton />}>
                    <RegisterPage />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route
                  index
                  element={<Navigate to="/dashboard/tasks" replace />}
                />
                <Route
                  path="tasks"
                  element={
                    <Suspense fallback={<TablePageSkeleton kind="tasks" />}>
                      <TasksPage />
                    </Suspense>
                  }
                />
                <Route
                  path="users"
                  element={
                    <Suspense fallback={<TablePageSkeleton kind="users" />}>
                      <UsersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Suspense fallback={<SettingsPageSkeleton />}>
                      <SettingsPage />
                    </Suspense>
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
