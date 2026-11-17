import { useTranslation } from "react-i18next"
import {
  FilterCombobox,
  type FilterOption,
} from "@workspace/shared-lib/components"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

export function UsersFilterBar({
  searchValue,
  onSearchChange,
  roleId,
  roleOptions,
  onRoleChange,
  onClear,
}: {
  searchValue: string
  onSearchChange: (value: string) => void
  roleId: string
  roleOptions: readonly FilterOption[]
  onRoleChange: (roleId: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={t("users.searchLabel")}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("users.searchPlaceholder")}
        className="w-56"
      />
      <FilterCombobox
        multiple={false}
        options={roleOptions}
        value={roleId}
        onValueChange={onRoleChange}
        ariaLabel={t("users.filters.role")}
        placeholder={t("users.filters.role")}
        className="h-7 w-56"
      />
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        {t("tasks.filters.clear")}
      </Button>
    </div>
  )
}
