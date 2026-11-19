export type VendorGroup = {
  name: string
  test: (moduleId: string) => boolean
  tags: ["$initial"]
  priority?: number
  minSize?: number
}

export const INITIAL_TAG: "$initial"
export const FORBIDDEN_IN_INITIAL: string[]
export const VENDOR_GROUPS: VendorGroup[]
export const VENDOR_FAMILIES: string[]
export const VENDOR_CODE_SPLITTING: {
  minSize: number
  maxSize: number
  groups: VendorGroup[]
}

export function packageNameOf(moduleId: string): string | null
export function isNodeModule(moduleId: string): boolean
