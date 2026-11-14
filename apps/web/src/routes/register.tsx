// Deep import: the `@/features/auth` barrel re-exports both forms, which can
// group login and register into one shared chunk even when only one renders.
import { RegisterForm } from "@/features/auth/components/register-form"

export function RegisterPage() {
  return <RegisterForm />
}
