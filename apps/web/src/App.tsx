import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/providers"
import { ProtectedRoute, RedirectIfAuthed } from "@/routes/protected-route"
import { DashboardLayout } from "@/routes/dashboard-layout"
import { LoginPage } from "@/routes/login"
import { RegisterPage } from "@/routes/register"
import { SettingsPage } from "@/routes/settings"
import { TasksPage } from "@/routes/tasks"
import { UsersPage } from "@/routes/users"

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Providers>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<RedirectIfAuthed />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route
                  index
                  element={<Navigate to="/dashboard/tasks" replace />}
                />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </Providers>
      </ThemeProvider>
    </BrowserRouter>
  )
}
