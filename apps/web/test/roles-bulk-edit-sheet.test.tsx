// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { I18nextProvider } from "react-i18next"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { RolesBulkEditSheet } from "@/features/roles/components/roles-bulk-edit-sheet"

beforeEach(async () => {
  await i18n.changeLanguage("en")
})

async function renderSheet(onApply: ReturnType<typeof vi.fn>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RolesBulkEditSheet
          open
          onOpenChange={vi.fn()}
          selectedCount={2}
          onApply={onApply}
          isApplying={false}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
  // The sheet mounts one animation frame after `open`; wait for its content.
  await screen.findByRole("button", { name: "Apply changes" })
  return userEvent.setup()
}

describe("RolesBulkEditSheet", () => {
  it("keeps Inactive available so the API reports System Role failures per item", async () => {
    const onApply = vi.fn()
    const user = await renderSheet(onApply)

    await user.click(screen.getByRole("combobox", { name: "Status" }))
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "No change",
      "Active",
      "Inactive",
    ])

    await user.click(screen.getByRole("option", { name: "Inactive" }))
    await user.click(screen.getByRole("button", { name: "Apply changes" }))

    // No client-side guard: the request reaches the API, whose `failed` array
    // is surfaced by the existing per-item failure notification.
    expect(onApply).toHaveBeenCalledWith({ status: "inactive" })
  })
})
