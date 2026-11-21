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
export { useBulkActions } from "./use-bulk-actions"
export type {
  BulkActionConfig,
  BulkActionOptions,
  BulkActions,
  BulkFailure,
  BulkTarget,
} from "./use-bulk-actions"
export { useDialog } from "./use-dialog"
export type { DialogState } from "./use-dialog"
export { useEnums } from "./use-enums"
export type { EnumOption, EnumOptionMap } from "./use-enums"
export { useClearIntent } from "./use-clear-intent"
export type {
  ClearIntent,
  ClearIntentOptions,
} from "./use-clear-intent"
