import { useTranslation } from "react-i18next"

/**
 * The authenticated home. A heading-only placeholder: it reuses the shell title
 * and the typography class already emitted by Settings and the auth forms, so
 * it adds no data hooks, translation keys, or CSS classes.
 */
export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <main className="p-6">
      <h1 className="text-lg font-medium">{t("shell.title")}</h1>
    </main>
  )
}
