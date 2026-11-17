import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

/**
 * Empty state for a Roles list with no matches. Administrators get the create
 * affordance; members see only the message. The create button is rendered from
 * the caller's access check, so later tickets can wire the drawer without
 * changing this component.
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
