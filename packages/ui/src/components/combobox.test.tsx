import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "./combobox"

const FRUITS = ["Apple", "Banana", "Blueberry", "Cherry"]

function SingleHarness({
  onValueChange,
  disabled,
  defaultValue,
}: {
  onValueChange?: (value: string | null) => void
  disabled?: boolean
  defaultValue?: string
}) {
  const [value, setValue] = React.useState<string | null>(null)

  return (
    <Combobox
      items={FRUITS}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={(next) => {
        setValue(next)
        onValueChange?.(next)
      }}
    >
      <ComboboxInput aria-label="Fruit" placeholder="All" />
      <ComboboxContent>
        <ComboboxEmpty>No results found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

describe("Combobox single selection", () => {
  it("filters the list and selects a value", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<SingleHarness onValueChange={onValueChange} />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    await user.click(input)
    expect(await screen.findByRole("listbox")).toBeInTheDocument()

    await user.type(input, "ban")

    expect(
      screen.getByRole("option", { name: "Banana" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "Apple" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("option", { name: "Banana" }))

    expect(onValueChange).toHaveBeenLastCalledWith("Banana")
    expect(input).toHaveValue("Banana")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("moves through options with the arrow keys and selects with Enter", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<SingleHarness onValueChange={onValueChange} />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    input.focus()

    await user.keyboard("{ArrowDown}")
    expect(await screen.findByRole("listbox")).toBeInTheDocument()

    await user.keyboard("{ArrowDown}{Enter}")

    expect(onValueChange).toHaveBeenLastCalledWith("Banana")
    expect(input).toHaveValue("Banana")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("closes the list on Escape without selecting", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<SingleHarness onValueChange={onValueChange} />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    await user.click(input)
    expect(await screen.findByRole("listbox")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

function MultiHarness({
  onValueChange,
  initialValue = [],
}: {
  onValueChange?: (value: string[]) => void
  initialValue?: string[]
}) {
  const [value, setValue] = React.useState<string[]>(initialValue)

  return (
    <Combobox
      multiple
      items={FRUITS}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange?.(next)
      }}
    >
      <ComboboxChips aria-label="Selected fruits">
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((item) => (
                <ComboboxChip key={item} aria-label={item}>
                  {item}
                  <ComboboxChipRemove aria-label={`Remove ${item}`} />
                </ComboboxChip>
              ))}
              <ComboboxInput aria-label="Fruit" placeholder="All" />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>No results found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

describe("Combobox multiple selection", () => {
  it("selects several values and renders a removable chip for each", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<MultiHarness onValueChange={onValueChange} />)

    const input = screen.getByRole("combobox", { name: "Fruit" })

    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "Apple" }))

    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "Banana" }))

    expect(onValueChange).toHaveBeenLastCalledWith(["Apple", "Banana"])
    expect(screen.getByRole("button", { name: "Remove Apple" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Remove Banana" })
    ).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Remove Apple" }))

    expect(onValueChange).toHaveBeenLastCalledWith(["Banana"])
    expect(
      screen.queryByRole("button", { name: "Remove Apple" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Remove Banana" })
    ).toBeVisible()
  })

  it("moves to a chip with Left Arrow and removes it with Backspace or Delete", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <MultiHarness
        initialValue={["Apple", "Banana"]}
        onValueChange={onValueChange}
      />
    )

    const input = screen.getByRole("combobox", { name: "Fruit" })
    input.focus()

    await user.keyboard("{ArrowLeft}")

    const bananaChip = screen.getByText("Banana").closest("[data-slot]")
    expect(bananaChip).toHaveFocus()

    await user.keyboard("{Backspace}")

    expect(onValueChange).toHaveBeenLastCalledWith(["Apple"])
    expect(
      screen.queryByRole("button", { name: "Remove Banana" })
    ).not.toBeInTheDocument()

    const appleChip = screen.getByText("Apple").closest("[data-slot]")
    expect(appleChip).toHaveFocus()

    await user.keyboard("{Delete}")

    expect(onValueChange).toHaveBeenLastCalledWith([])
    expect(
      screen.queryByRole("button", { name: "Remove Apple" })
    ).not.toBeInTheDocument()
  })
})

function ClearHarness({
  onValueChange,
}: {
  onValueChange?: (value: string | null) => void
}) {
  return (
    <Combobox
      items={FRUITS}
      defaultValue="Apple"
      onValueChange={(next) => onValueChange?.(next)}
    >
      <div className="relative">
        <ComboboxInput aria-label="Fruit" placeholder="All" />
        <ComboboxClear aria-label="Clear" />
      </div>
      <ComboboxContent>
        <ComboboxEmpty>No results found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

describe("Combobox states", () => {
  it("shows the empty state when nothing matches the query", async () => {
    const user = userEvent.setup()
    render(<SingleHarness />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    await user.click(input)
    await user.type(input, "zzz")

    expect(screen.getByText("No results found.")).toBeVisible()
    expect(screen.queryByRole("option")).not.toBeInTheDocument()
  })

  it("does not open or accept input when disabled", async () => {
    const user = userEvent.setup()
    render(<SingleHarness disabled />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    expect(input).toBeDisabled()

    await user.click(input)

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("clears the selected value with the clear control", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ClearHarness onValueChange={onValueChange} />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    expect(input).toHaveValue("Apple")

    await user.click(screen.getByRole("button", { name: "Clear" }))

    expect(onValueChange).toHaveBeenLastCalledWith(null)
    expect(input).toHaveValue("")
    expect(input).toHaveAttribute("placeholder", "All")
  })
})

describe("Combobox controlled and uncontrolled selection", () => {
  it("emits changes while keeping a controlled value fixed", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Combobox items={FRUITS} value="Apple" onValueChange={onValueChange}>
        <ComboboxInput aria-label="Fruit" placeholder="All" />
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    )

    const input = screen.getByRole("combobox", { name: "Fruit" })
    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "Banana" }))

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("Banana", expect.anything())
    expect(input).toHaveValue("Apple")
  })

  it("updates itself when uncontrolled", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ClearHarness onValueChange={onValueChange} />)

    const input = screen.getByRole("combobox", { name: "Fruit" })
    await user.click(input)
    await user.click(await screen.findByRole("option", { name: "Banana" }))

    expect(onValueChange).toHaveBeenLastCalledWith("Banana")
    expect(input).toHaveValue("Banana")
  })
})

describe("Combobox popup", () => {
  it("aligns to the anchor at the bottom start by default", async () => {
    const user = userEvent.setup()
    render(<SingleHarness />)

    await user.click(screen.getByRole("combobox", { name: "Fruit" }))
    const popup = (await screen.findByRole("listbox")).parentElement

    expect(popup).toHaveAttribute("data-slot", "combobox-content")
    expect(popup).toHaveAttribute("data-side", "bottom")
    expect(popup).toHaveAttribute("data-align", "start")
  })

  it("lets callers override the placement", async () => {
    const user = userEvent.setup()
    render(
      <Combobox items={FRUITS}>
        <ComboboxInput aria-label="Fruit" placeholder="All" />
        <ComboboxContent side="top" align="end">
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    )

    await user.click(screen.getByRole("combobox", { name: "Fruit" }))
    const popup = (await screen.findByRole("listbox")).parentElement

    expect(popup).toHaveAttribute("data-side", "top")
    expect(popup).toHaveAttribute("data-align", "end")
  })
})
