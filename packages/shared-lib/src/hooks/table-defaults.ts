/**
 * Page size a data table uses when the URL has no `pageSize` param.
 *
 * Kept in its own module so non-table consumers (for example the page
 * skeletons) can import the constant without pulling the URL/table hook and
 * its router dependencies into the entry chunk.
 */
export const DEFAULT_PAGE_SIZE = 30
