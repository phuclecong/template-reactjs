import { useMemo, type ComponentProps } from "react"
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
import { XIcon } from "lucide-react"
import { joinFilterValues, parseFilterValues } from "../utils"

/** A filter choice: the URL value plus its translated display label. */
export type FilterOption = { value: string; label: string }

type ComboboxFilterProps = {
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
  /** Associates the input with a form label. */
  id?: string
  disabled?: boolean
  /** Marks the control invalid for form validation. */
  ariaInvalid?: boolean
  /**
   * Single-select only: show the clear control. Filter bars usually want it so
   * empty can mean "all"; a required form field does not.
   */
  showClear?: boolean
  multiple?: boolean
}

const optionValueEquals = (option: FilterOption, selected: FilterOption) =>
  option.value === selected.value

// Unknown values (for example a deleted User id still in the URL) fall back to
// their raw value so their chips stay visible and removable.
const fallbackOption = (value: string): FilterOption => ({
  value,
  label: value,
})

type ComboboxFilterContentProps = {
  /** Forwarded to `ComboboxContent`; multi-select anchors the popup to its chips. */
  anchor?: ComponentProps<typeof ComboboxContent>["anchor"]
}

function ComboboxFilterContent({ anchor }: ComboboxFilterContentProps) {
  const { t } = useTranslation()

  return (
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
  )
}

function MultiSelectComboboxFilter({
  options,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className,
  id,
  disabled,
  ariaInvalid,
}: ComboboxFilterProps) {
  const { t } = useTranslation()
  const selectedValues = useMemo(() => parseFilterValues(value), [value])
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  )
  const selectedOptions = useMemo(
    () =>
      selectedValues.map(
        (selectedValue) =>
          optionByValue.get(selectedValue) ?? fallbackOption(selectedValue)
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
      disabled={disabled}
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
                id={id}
                aria-label={ariaLabel}
                aria-invalid={ariaInvalid}
                disabled={disabled}
                placeholder={selected.length > 0 ? "" : placeholder}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxFilterContent anchor={anchor} />
    </Combobox>
  )
}

function SingleSelectComboboxFilter({
  options,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className,
  id,
  disabled,
  ariaInvalid,
  showClear,
}: ComboboxFilterProps) {
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(next: FilterOption | null) =>
        onValueChange(next?.value ?? "")
      }
      isItemEqualToValue={optionValueEquals}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        className={className}
        showTrigger={true}
        showClear={!!selectedOption?.value && showClear}
        disabled={disabled}
      />
      <ComboboxFilterContent />
    </Combobox>
  )
}

/**
 * Filter control over a scalar URL value: comma-joined chips in multi-select
 * mode, a searchable field with a labelled clear control in single-select mode.
 */
export function ComboboxFilter(props: ComboboxFilterProps) {
  return props.multiple ? (
    <MultiSelectComboboxFilter {...props} />
  ) : (
    <SingleSelectComboboxFilter {...props} />
  )
}
