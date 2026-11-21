export { DEFAULT_PAGE_SIZE } from "./table-defaults"
export { useTableShell } from "./use-table-shell"
export type { TableShell, TableShellConfig } from "./use-table-shell"
export { createTableUrlAdapter } from "./url-table-state"
export type {
  TableUrlAdapter,
  TableUrlAdapterConfig,
  TableUrlState,
} from "./url-table-state"
// Descriptor types live in the utils layer; re-exporting them here keeps the
// hooks barrel's public surface unchanged.
export type {
  TableUrlDateRangeFilter,
  TableUrlEnumMultiFilter,
  TableUrlFilterDescriptor,
  TableUrlTextFilter,
} from "../utils/table-url-descriptors"
export { useDialog } from "./use-dialog"
export type { DialogState } from "./use-dialog"
export { useEnums } from "./use-enums"
export type { EnumOption, EnumOptionMap } from "./use-enums"
