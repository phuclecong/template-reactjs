import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@workspace/ui/components/combobox"
import { InputGroupButton } from "@workspace/ui/components/input-group"
import { XIcon } from "lucide-react"
import { joinFilterValues, parseFilterValues } from "../utils"

/** A filter choice: the URL value plus its translated display label. */
export type FilterOption = { value: string; label: string }

type FilterComboboxSharedProps = {
  /** Translated options; callers memoize the array for stable item identity. */
  options: readonly FilterOption[]
  /** Comma-joined for multi-select, scalar for single-select. */
  value: string
  /** Emits the same scalar contract the caller passed in. */
  onValueChange: (value: string) => void
  ariaLabel: string
  placeholder: string
  /** Forwarded to the multi-select chips wrapper or the single-select input. */
  className?: string
}

export type FilterComboboxProps =
  | (FilterComboboxSharedProps & { multiple: true })
  | (FilterComboboxSharedProps & { multiple: false })

const optionValueEquals = (option: FilterOption, selected: FilterOption) =>
  option.value === selected.value

function MultiSelectFilterCombobox({
  options,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className,
}: FilterComboboxSharedProps) {
  const { t } = useTranslation()
  const selectedValues = useMemo(() => parseFilterValues(value), [value])
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  )
  // Unknown values (for example a deleted User id still in the URL) fall back
  // to their raw value so their chips stay visible and removable.
  const selectedOptions = useMemo(
    () =>
      selectedValues.map(
        (selectedValue) =>
          optionByValue.get(selectedValue) ?? {
            value: selectedValue,
            label: selectedValue,
          }
      ),
    [optionByValue, selectedValues]
  )
  const anchor = useComboboxAnchor()

  // The registry chip exposes removal through `showRemove`, whose internal
  // control is icon-only. Compose a labelled Button so the mouse affordance
  // keeps its accessible name; the chip itself still handles Backspace and
  // Delete, and Left/Right Arrow moves focus between chips.
  const removeValue = (
    selected: readonly FilterOption[],
    removed: FilterOption
  ) =>
    onValueChange(
      joinFilterValues(
        selected
          .filter((option) => option.value !== removed.value)
          .map((option) => option.value)
      )
    )

  return (
    <Combobox
      multiple
      items={options}
      value={selectedOptions}
      onValueChange={(next: FilterOption[]) =>
        onValueChange(joinFilterValues(next.map((option) => option.value)))
      }
      onOpenChange={(open, details) => {
        // Multi-select: picking a value must not close the popup, so several
        // values can be chosen from one query.
        if (!open && details.reason === "item-press") details.cancel()
      }}
      isItemEqualToValue={optionValueEquals}
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(selected: readonly FilterOption[]) => (
            <>
              {selected.map((selectedOption) => {
                const label = selectedOption.label
                return (
                  <ComboboxChip
                    key={selectedOption.value}
                    aria-label={label}
                    showRemove={false}
                  >
                    {label}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("combobox.removeChip", { value: label })}
                      className="-ml-1 opacity-50 hover:opacity-100"
                      onClick={() => removeValue(selected, selectedOption)}
                    >
                      <XIcon className="pointer-events-none" />
                    </Button>
                  </ComboboxChip>
                )
              })}
              <ComboboxChipsInput
                aria-label={ariaLabel}
                placeholder={selected.length > 0 ? "" : placeholder}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{t("combobox.noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(option: FilterOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function SingleSelectFilterCombobox({
  options,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className,
}: FilterComboboxSharedProps) {
  const { t } = useTranslation()
  const selectedOption = useMemo(() => {
    const match = options.find((option) => option.value === value)
    if (match) return match
    return value ? { value, label: value } : null
  }, [options, value])

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(next: FilterOption | null) =>
        onValueChange(next?.value ?? "")
      }
      isItemEqualToValue={optionValueEquals}
    >
      <ComboboxInput
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={className}
        showTrigger={false}
      >
        {selectedOption ? (
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("common.clear")}
            className="mr-0.5"
            onClick={() => onValueChange("")}
          >
            <XIcon className="pointer-events-none" />
          </InputGroupButton>
        ) : null}
      </ComboboxInput>

      <ComboboxContent>
        <ComboboxEmpty>{t("combobox.noResults")}</ComboboxEmpty>
        <ComboboxList>
          {(option: FilterOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/**
 * Filter control over a scalar URL value: comma-joined chips in multi-select
 * mode, a searchable field with a labelled clear control in single-select mode.
 */
export function FilterCombobox(props: FilterComboboxProps) {
  return props.multiple ? (
    <MultiSelectFilterCombobox {...props} />
  ) : (
    <SingleSelectFilterCombobox {...props} />
  )
}
