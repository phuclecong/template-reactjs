// Deep import: the `@/features/auth` barrel re-exports both forms, which can
// group login and register into one shared chunk even when only one renders.
import { LoginForm } from "@/features/auth/components/login-form"

export function LoginPage() {
  return <LoginForm />
}
