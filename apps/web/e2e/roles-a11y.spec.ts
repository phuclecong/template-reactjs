import { expect, test, type Page } from "@playwright/test"

import { login } from "./helpers"

async function openRoles(page: Page) {
  await page.getByRole("link", { name: "Roles" }).click()
  await expect(page).toHaveURL(/\/roles/)
  await expect(page.getByRole("table")).toBeVisible()
}

async function loginAsAdmin(page: Page) {
  await login(page, "admin@example.com", "adminpass")
  await openRoles(page)
}

async function loginAsMember(page: Page) {
  await login(page, "member@example.com", "memberpass")
  await openRoles(page)
}

/** Assert the element that currently holds focus exposes the given name. */
async function expectFocusedName(page: Page, name: string) {
  await expect(page.locator(":focus")).toHaveAccessibleName(name)
}

async function tabTo(page: Page, name: string) {
  await page.keyboard.press("Tab")
  await expectFocusedName(page, name)
}

/**
 * Assert that the given selectors appear in document order. Tab order follows
 * document order for the controls on this screen (none use a positive
 * tabindex), so this is the same sequence a keyboard user traverses.
 */
async function expectDocumentOrder(page: Page, selectors: string[]) {
  await expect
    .poll(() =>
      page.evaluate((values) => {
        const nodes = values.map((selector) =>
          document.querySelector(selector)
        )
        if (nodes.some((node) => node === null)) return false
        return nodes.every((node, index) => {
          const next = nodes[index + 1]
          if (!next) return true
          return Boolean(
            node!.compareDocumentPosition(next) &
              Node.DOCUMENT_POSITION_FOLLOWING
          )
        })
      }, selectors)
    )
    .toBe(true)
}

function bulkBar(page: Page) {
  return page.getByRole("region", { name: "Bulk actions" })
}

function rowCheckbox(page: Page, title: string) {
  return page.getByRole("checkbox", { name: `Select ${title}` })
}

test.describe("administrator", () => {
  test("sortable column headers expose aria-sort and toggle with Enter", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    const titleHeader = page.getByRole("columnheader", { name: "Title" })
    const updatedHeader = page.getByRole("columnheader", { name: "Updated" })

    // Default sort is updatedAt descending; sortable headers announce their
    // state, and non-sortable Description exposes no sort state or button.
    await expect(updatedHeader).toHaveAttribute("aria-sort", "descending")
    await expect(titleHeader).toHaveAttribute("aria-sort", "none")
    await expect(
      page.getByRole("columnheader", { name: "Description" })
    ).not.toHaveAttribute("aria-sort", "none")
    await expect(
      page.getByRole("columnheader", { name: "Description" }).getByRole("button")
    ).toHaveCount(0)

    // The header is a real button, so it is focusable and Enter-operable.
    await titleHeader.getByRole("button").focus()
    await expectFocusedName(page, "Title")
    await page.keyboard.press("Enter")
    await expect(titleHeader).toHaveAttribute("aria-sort", "ascending")
    await expect(page).toHaveURL(/[?&]order=asc\b/)
    await expect(page.locator("tbody tr").nth(0)).toContainText("Administrator")

    await page.keyboard.press("Enter")
    await expect(titleHeader).toHaveAttribute("aria-sort", "descending")
    await expect(page).toHaveURL(/[?&]order=desc\b/)
    await expect(page.locator("tbody tr").nth(0)).toContainText("Member")
  })

  test("filters, selection, row actions, and pagination have accessible names", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    // The filter bar is one named group; every control inside it is labelled.
    await expect(
      page.getByRole("group", { name: "Filters" })
    ).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible()
    await expect(
      page.getByRole("textbox", { name: "Description" })
    ).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Created date" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Updated date" })
    ).toBeVisible()

    // Selection: a page-scoped header checkbox and one named checkbox per row.
    await expect(
      page.getByRole("checkbox", { name: "Select all roles on this page" })
    ).toBeVisible()
    await expect(rowCheckbox(page, "Member")).toBeVisible()
    await expect(rowCheckbox(page, "Demo Role 58")).toBeVisible()

    // Row actions: System Roles expose Edit only; demo Roles expose both.
    const memberRow = page.getByRole("row").filter({ hasText: "Member" }).first()
    await expect(
      memberRow.getByRole("button", { name: "Edit" })
    ).toBeVisible()
    await expect(
      memberRow.getByRole("button", { name: "Delete" })
    ).toHaveCount(0)

    const demoRow = page
      .getByRole("row")
      .filter({ hasText: "Demo Role 58" })
      .first()
    await expect(demoRow.getByRole("button", { name: "Edit" })).toBeVisible()
    await expect(demoRow.getByRole("button", { name: "Delete" })).toBeVisible()

    // Pagination: the landmark and each control are named, and the current
    // page is announced.
    const pagination = page.getByRole("navigation", { name: "Pagination" })
    await expect(pagination).toBeVisible()
    await expect(
      pagination.getByRole("button", { name: "Previous page" })
    ).toBeVisible()
    await expect(
      pagination.getByRole("button", { name: "Next page" })
    ).toBeVisible()
    await expect(
      pagination.getByRole("button", { name: "Page 1" })
    ).toHaveAttribute("aria-current", "page")
    await expect(
      page.getByRole("combobox", { name: "Rows per page" })
    ).toBeVisible()
  })

  test("pagination announces the current page and edge controls leave the tab order", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    const pagination = page.getByRole("navigation", { name: "Pagination" })
    const previous = pagination.getByRole("button", { name: "Previous page" })
    const next = pagination.getByRole("button", { name: "Next page" })

    // First page: Previous is announced disabled and removed from tab order.
    await expect(
      pagination.getByRole("button", { name: "Page 1" })
    ).toHaveAttribute("aria-current", "page")
    await expect(previous).toHaveAttribute("aria-disabled", "true")
    await expect(previous).toHaveAttribute("tabindex", "-1")
    await expect(next).not.toHaveAttribute("aria-disabled", "true")
    await expect(next).not.toHaveAttribute("tabindex", "-1")

    // The page links are real buttons: focus and Enter navigate.
    const pageTwo = pagination.getByRole("button", { name: "Page 2" })
    await pageTwo.focus()
    await expectFocusedName(page, "Page 2")
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(/[?&]page=2\b/)
    await expect(pageTwo).toHaveAttribute("aria-current", "page")
    await expect(
      pagination.getByRole("button", { name: "Page 1" })
    ).not.toHaveAttribute("aria-current", "page")

    // Last page: Next is disabled and leaves the tab order; Previous returns.
    await expect(next).toHaveAttribute("aria-disabled", "true")
    await expect(next).toHaveAttribute("tabindex", "-1")
    await expect(previous).not.toHaveAttribute("aria-disabled", "true")
    await expect(previous).not.toHaveAttribute("tabindex", "-1")
  })

  test("row Edit opens the form drawer from the keyboard", async ({ page }) => {
    await loginAsAdmin(page)

    const row = page.getByRole("row").filter({ hasText: "Member" }).first()
    const edit = row.getByRole("button", { name: "Edit" })
    await edit.focus()
    await expectFocusedName(page, "Edit")
    await page.keyboard.press("Enter")

    const drawer = page.getByRole("dialog")
    await expect(drawer).toBeVisible()
    await expect(
      drawer.getByRole("heading", { name: "Edit role" })
    ).toBeVisible()
    await expect(drawer.getByLabel("Title")).toHaveValue("Member")
  })

  test("single-role delete confirmation is operable end to end from the keyboard", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    // Demo Role 31 is a non-System Role, so it exposes Delete.
    const row = page
      .getByRole("row")
      .filter({ hasText: "Demo Role 31" })
      .first()
    const destroy = row.getByRole("button", { name: "Delete" })
    await destroy.focus()
    await expectFocusedName(page, "Delete")
    await page.keyboard.press("Enter")

    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("Delete role?")
    await expect(dialog).toContainText("Demo Role 31")

    const confirm = dialog.getByRole("button", { name: "Delete" })
    await confirm.focus()
    await expectFocusedName(page, "Delete")
    await page.keyboard.press("Enter")

    await expect(page.getByText("Role deleted")).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("row").filter({ hasText: "Demo Role 31" })
    ).toHaveCount(0)
  })

  test("bulk edit and bulk delete are operable end to end from the keyboard", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    // Select a row with Space; the page-scoped bar appears.
    const select = rowCheckbox(page, "Demo Role 31")
    await select.focus()
    await page.keyboard.press("Space")
    await expect(select).toBeChecked()
    await expect(bulkBar(page)).toBeVisible()
    await expect(bulkBar(page)).toContainText("1 selected")

    // Bulk edit opens from Enter; change a field and apply with the keyboard.
    const bulkEdit = bulkBar(page).getByRole("button", {
      name: "Edit",
      exact: true,
    })
    await bulkEdit.focus()
    await expectFocusedName(page, "Edit")
    await page.keyboard.press("Enter")

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("heading", { name: "Edit 1 roles" })
    ).toBeVisible()

    const clearDescription = dialog.getByRole("button", {
      name: "Clear description",
    })
    await clearDescription.focus()
    await page.keyboard.press("Enter")
    await expect(
      dialog.getByText("The description will be cleared.")
    ).toBeVisible()

    const apply = dialog.getByRole("button", { name: "Apply changes" })
    await apply.focus()
    await page.keyboard.press("Enter")
    await expect(
      page.getByText("Roles updated: 1", { exact: true })
    ).toBeVisible()
    await expect(bulkBar(page)).toHaveCount(0)

    // Bulk delete is confirmed and executed with the keyboard.
    await select.focus()
    await page.keyboard.press("Space")
    await expect(bulkBar(page)).toBeVisible()

    const bulkDelete = bulkBar(page).getByRole("button", {
      name: "Delete",
      exact: true,
    })
    await bulkDelete.focus()
    await page.keyboard.press("Enter")

    const confirm = page.getByRole("alertdialog")
    await expect(confirm).toBeVisible()
    const deleteConfirm = confirm.getByRole("button", {
      name: "Delete roles",
    })
    await deleteConfirm.focus()
    await page.keyboard.press("Enter")

    await expect(
      page.getByText("Roles deleted: 1", { exact: true })
    ).toBeVisible()
    await expect(bulkBar(page)).toHaveCount(0)
  })

  test("keyboard order runs bulk bar, filters, headers, row actions, pagination", async ({
    page,
  }) => {
    await loginAsAdmin(page)

    // Filters come first.
    await page.getByRole("textbox", { name: "Title" }).focus()
    await expectFocusedName(page, "Title")
    await tabTo(page, "Description")
    await tabTo(page, "Status")
    await tabTo(page, "Created date")
    await tabTo(page, "Updated date")

    // Then the table's header controls, in column order.
    await tabTo(page, "Select all roles on this page")
    await tabTo(page, "Title")
    await tabTo(page, "Status")
    await tabTo(page, "Created")
    await tabTo(page, "Updated")

    // Then the first row's selection control and row actions.
    await tabTo(page, "Select Member")
    await tabTo(page, "Edit")

    // The table (and therefore its row actions) precedes the pagination.
    await expectDocumentOrder(page, [
      '[role="group"][aria-label="Filters"]',
      "table",
      'nav[aria-label="Pagination"]',
    ])

    // Selecting a row reveals the bulk bar in the page header, beside Create,
    // so the page's primary controls stay together above the filters.
    await rowCheckbox(page, "Member").focus()
    await page.keyboard.press("Space")
    await expect(bulkBar(page)).toBeVisible()
    await expectDocumentOrder(page, [
      "h1",
      '[role="region"][aria-label="Bulk actions"]',
      '[role="group"][aria-label="Filters"]',
      "table",
      'nav[aria-label="Pagination"]',
    ])

    await bulkBar(page)
      .getByRole("button", { name: "Edit", exact: true })
      .focus()
    await expectFocusedName(page, "Edit")
  })
})

test.describe("member", () => {
  test("sees the same sortable, filterable, paginated list without action controls", async ({
    page,
  }) => {
    await loginAsMember(page)

    // Sorting is keyboard operable for Members too.
    const titleHeader = page.getByRole("columnheader", { name: "Title" })
    await expect(
      page.getByRole("columnheader", { name: "Updated" })
    ).toHaveAttribute("aria-sort", "descending")
    await titleHeader.getByRole("button").focus()
    await page.keyboard.press("Enter")
    await expect(titleHeader).toHaveAttribute("aria-sort", "ascending")
    await expect(page.locator("tbody tr").nth(0)).toContainText("Administrator")

    // The same labelled filter controls and pagination are present.
    await expect(page.getByRole("group", { name: "Filters" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible()
    await expect(
      page.getByRole("textbox", { name: "Description" })
    ).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Created date" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Updated date" })
    ).toBeVisible()

    const pagination = page.getByRole("navigation", { name: "Pagination" })
    await expect(pagination).toBeVisible()
    await expect(
      pagination.getByRole("button", { name: "Page 1" })
    ).toHaveAttribute("aria-current", "page")
    await expect(
      pagination.getByRole("button", { name: "Previous page" })
    ).toHaveAttribute("tabindex", "-1")
    await expect(
      page.getByRole("combobox", { name: "Rows per page" })
    ).toBeVisible()

    // No selection, row actions, bulk actions, or create affordances.
    await expect(page.getByRole("checkbox")).toHaveCount(0)
    await expect(bulkBar(page)).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Create role", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Edit", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Delete", exact: true })
    ).toHaveCount(0)
    await expect(page.getByRole("columnheader")).toHaveCount(5)
    await expect(
      page.getByRole("columnheader", { name: "Actions" })
    ).toHaveCount(0)
  })

  test("filters the catalogue from the keyboard without exposing writes", async ({
    page,
  }) => {
    await loginAsMember(page)

    const titleFilter = page.getByRole("textbox", { name: "Title" })
    await titleFilter.focus()
    await page.keyboard.type("demo role 42")

    await expect
      .poll(() => new URL(page.url()).searchParams.get("title"))
      .toBe("demo role 42")
    await expect(page.locator("tbody tr")).toHaveCount(1)
    await expect(page.locator("tbody tr").nth(0)).toContainText("Demo Role 42")

    // Filtering never reveals a write or bulk control to a Member.
    await expect(page.getByRole("checkbox")).toHaveCount(0)
    await expect(bulkBar(page)).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Edit", exact: true })
    ).toHaveCount(0)
  })
})
