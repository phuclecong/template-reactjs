import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { Input } from "@workspace/ui/components/input"
import { InputGroup } from "@workspace/ui/components/input-group"
import { ROLE_OPTIONS } from "@/features/users/utils"

export function UsersFilterBar({
  searchValue,
  onSearchChange,
  role,
  onRoleChange,
  onClear,
}: {
  searchValue: string
  onSearchChange: (value: string) => void
  role: string
  onRoleChange: (role: string) => void
  onClear: () => void
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
  const selectedRole =
    roleOptions.find((option) => option.value === role) ?? null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={t("users.searchLabel")}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("users.searchPlaceholder")}
        className="w-72"
      />
      <Combobox
        items={roleOptions}
        value={selectedRole}
        onValueChange={(option) => onRoleChange(option?.value ?? "")}
      >
        <InputGroup className="w-56">
          <ComboboxInput
            aria-label={t("users.filters.role")}
            placeholder={t("users.filters.all")}
            className="h-7 flex-1 border-0 bg-transparent px-2 shadow-none ring-0 focus-visible:ring-0 dark:bg-transparent"
          />
          <ComboboxClear aria-label={t("common.clear")} />
          <ComboboxIcon
            aria-hidden="true"
            className="pointer-events-none mr-1.5"
          />
        </InputGroup>
        <ComboboxContent>
          <ComboboxEmpty>{t("combobox.noResults")}</ComboboxEmpty>
          <ComboboxList>
            {(option: { value: string; label: string }) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        {t("users.filters.clear")}
      </Button>
    </div>
  )
}
