import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { InputGroupButton } from "@workspace/ui/components/input-group"
import { Input } from "@workspace/ui/components/input"
import { XIcon } from "lucide-react"
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
        <ComboboxInput
          aria-label={t("users.filters.role")}
          placeholder={t("users.filters.all")}
          className="h-7 w-56"
          showTrigger={false}
        >
          {selectedRole ? (
            <InputGroupButton
              variant="ghost"
              size="icon-xs"
              aria-label={t("common.clear")}
              className="mr-0.5"
              onClick={() => onRoleChange("")}
            >
              <XIcon className="pointer-events-none" />
            </InputGroupButton>
          ) : null}
        </ComboboxInput>

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
    </div>
  )
}
