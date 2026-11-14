/**
 * Split a comma-joined URL filter value into trimmed, non-empty values.
 * An empty value yields an empty list, which means "all values".
 */
export function parseFilterValues(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Join selected values into the comma-joined value stored in the URL. */
export function joinFilterValues(values: string[]): string {
  return values.join(",")
}
