import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

/**
 * Empty state for a Roles list with no matches. Administrators get the create
 * affordance; members see only the message. Visibility is decided by the
 * caller's access check and `onCreate` opens the shared role drawer.
 */
export function RolesEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean
  onCreate?: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 border border-border px-6 py-12 text-center">
      <p className="font-medium">{t("roles.empty")}</p>
      <p className="text-muted-foreground">{t("roles.emptyHint")}</p>
      {canCreate ? (
        <Button type="button" onClick={onCreate}>
          {t("roles.create")}
        </Button>
      ) : null}
    </div>
  )
}
