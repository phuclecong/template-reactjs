import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

import { describeError } from "@/utils/http-error"

/**
 * Inline failure surface for the Roles list. A list request failure keeps the
 * page shell in place and offers retry instead of blanking the screen.
 */
export function RolesErrorPanel({
  error,
  onRetry,
  isRetrying,
}: {
  error: unknown
  onRetry: () => void
  isRetrying: boolean
}) {
  const { t } = useTranslation()
  const description = describeError(error)

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <p className="font-medium">{t("roles.error")}</p>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRetrying}
        onClick={onRetry}
      >
        {t("roles.retry")}
      </Button>
    </div>
  )
}
