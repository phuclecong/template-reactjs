import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { expect, screen, userEvent, within } from "@storybook/test"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "./combobox"

const FRUITS = ["Apple", "Banana", "Blueberry", "Cherry", "Mango"]

type ProduceGroup = { value: string; items: string[] }

const PRODUCE_GROUPS: ProduceGroup[] = [
  { value: "Fruits", items: ["Apple", "Banana", "Mango"] },
  { value: "Vegetables", items: ["Carrot", "Lettuce", "Spinach"] },
]

function SingleCombobox({
  defaultValue,
  disabled,
}: {
  defaultValue?: string
  disabled?: boolean
}) {
  return (
    <Combobox items={FRUITS} defaultValue={defaultValue} disabled={disabled}>
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

function MultiCombobox() {
  const [value, setValue] = React.useState<string[]>(["Apple"])
  const anchor = useComboboxAnchor()

  return (
    <Combobox
      multiple
      items={FRUITS}
      value={value}
      onValueChange={(next) => setValue(next)}
    >
      <ComboboxChips ref={anchor} aria-label="Selected fruits" className="w-full">
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((item) => (
                <ComboboxChip key={item} aria-label={item}>
                  {item}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput aria-label="Fruit" placeholder="All" />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
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

function GroupedCombobox() {
  return (
    <Combobox items={PRODUCE_GROUPS}>
      <ComboboxInput aria-label="Produce" placeholder="All" />
      <ComboboxContent>
        <ComboboxEmpty>No results found.</ComboboxEmpty>
        <ComboboxList>
          {(group: ProduceGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              {group.items.map((item) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

const meta = {
  title: "Primitives/Combobox",
  component: Combobox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
} satisfies Meta<typeof Combobox>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: () => <SingleCombobox />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("combobox", { name: "Fruit" })

    await userEvent.click(input)
    await userEvent.type(input, "ban")

    await expect(
      within(document.body).getByRole("option", { name: "Banana" })
    ).toBeVisible()

    await userEvent.keyboard("{ArrowDown}{Enter}")

    await expect(input).toHaveValue("Banana")
  },
}

export const MultiWithChips: Story = {
  render: () => <MultiCombobox />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("combobox", { name: "Fruit" })

    await userEvent.click(input)
    await userEvent.type(input, "ban")
    await userEvent.keyboard("{ArrowDown}{Enter}")

    await expect(canvas.getByLabelText("Apple")).toBeVisible()
    await expect(canvas.getByLabelText("Banana")).toBeVisible()

    // The registry chip renders its own remove control; target it through the
    // chip's accessible name rather than its generated markup.
    await userEvent.click(within(canvas.getByLabelText("Apple")).getByRole("button"))

    await expect(canvas.queryByLabelText("Apple")).not.toBeInTheDocument()
  },
}

export const Grouped: Story = {
  render: () => <GroupedCombobox />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("combobox", { name: "Produce" })

    await userEvent.click(input)
    await userEvent.type(input, "car")

    await expect(
      within(document.body).getByRole("option", { name: "Carrot" })
    ).toBeVisible()
    await expect(
      within(document.body).queryByRole("option", { name: "Apple" })
    ).not.toBeInTheDocument()

    await userEvent.keyboard("{ArrowDown}{Enter}")

    await expect(input).toHaveValue("Carrot")
  },
}

export const Disabled: Story = {
  render: () => <SingleCombobox defaultValue="Apple" disabled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("combobox", { name: "Fruit" })

    await expect(input).toHaveAttribute("data-disabled")
    await expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  render: () => <SingleCombobox />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("combobox", { name: "Fruit" })

    await userEvent.click(input)
    await userEvent.type(input, "zzz")

    await expect(screen.getByText("No results found.")).toBeVisible()
  },
}
