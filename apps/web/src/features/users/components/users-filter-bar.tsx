import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { FilterCombobox } from "@workspace/shared-lib/components"
import { Input } from "@workspace/ui/components/input"
import { ROLE_OPTIONS } from "@/features/users/utils"

export function UsersFilterBar({
  searchValue,
  onSearchChange,
  role,
  onRoleChange,
}: {
  searchValue: string
  onSearchChange: (value: string) => void
  role: string
  onRoleChange: (role: string) => void
}) {
  const { t } = useTranslation()

  const roleOptions = useMemo(
    () =>
      ROLE_OPTIONS.map((option) => ({
        value: option,
        label: t(`users.role.${option}`),
      })),
    [t]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={t("users.searchLabel")}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("users.searchPlaceholder")}
        className="w-72"
      />
      <FilterCombobox
        multiple={false}
        options={roleOptions}
        value={role}
        onValueChange={onRoleChange}
        ariaLabel={t("users.filters.role")}
        placeholder={t("users.filters.role")}
        className="h-7 w-56"
      />
    </div>
  )
}
