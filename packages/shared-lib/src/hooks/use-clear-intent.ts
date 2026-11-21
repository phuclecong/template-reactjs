import { useCallback, useState } from "react"

/** Options accepted by {@link useClearIntent}. */
export type ClearIntentOptions<Field extends string = string> = {
  /** React Hook Form's `formState.dirtyFields`. */
  dirtyFields: Partial<Record<Field, unknown>>
  /** React Hook Form's `formState.isDirty`. */
  isDirty: boolean
}

/** The value returned by {@link useClearIntent}. */
export type ClearIntent<Field extends string = string> = {
  /** True when RHF reports `field` dirty or an explicit clear was recorded. */
  isFieldDirty: (field: Field) => boolean
  /** True when RHF reports the form dirty or any explicit clear is recorded. */
  hasChanges: boolean
  /** Record that the Administrator explicitly cleared `field`. */
  markCleared: (field: Field) => void
  /** Drop the explicit-clear record for `field`, e.g. when its control changes. */
  resetCleared: (field: Field) => void
}

/**
 * Tracks an explicit "clear" intent for fields whose empty value is also their
 * default. React Hook Form unsets `dirtyFields[field]` when a value is reverted
 * to the default `""`, so a Clear click that writes `""` would otherwise leave
 * both the field and the form clean. This hook records that intent separately
 * and folds it into the field-dirty and form-dirty checks.
 *
 * This is local form state, not data fetching, so no Refine core hook covers
 * it; composing `useForm` alone cannot distinguish "never touched" from
 * "explicitly cleared to the default".
 */
export function useClearIntent<Field extends string = string>({
  dirtyFields,
  isDirty,
}: ClearIntentOptions<Field>): ClearIntent<Field> {
  const [cleared, setCleared] = useState<ReadonlySet<Field>>(() => new Set())

  const markCleared = useCallback((field: Field) => {
    setCleared((current) => {
      if (current.has(field)) return current
      const next = new Set(current)
      next.add(field)
      return next
    })
  }, [])

  const resetCleared = useCallback((field: Field) => {
    setCleared((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
  }, [])

  const isFieldDirty = useCallback(
    (field: Field) => Boolean(dirtyFields[field]) || cleared.has(field),
    [cleared, dirtyFields]
  )

  return {
    isFieldDirty,
    hasChanges: isDirty || cleared.size > 0,
    markCleared,
    resetCleared,
  }
}
