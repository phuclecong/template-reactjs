import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  roleStatusSchema,
  taskPrioritySchema,
  taskStatusSchema,
  type RoleStatus,
  type TaskPriority,
  type TaskStatus,
} from "@workspace/api/schemas"

/** A translated enum choice: the contract value plus its display label. */
export type EnumOption<T extends string> = { value: T; label: string }

/** Translated choices for every global enum list, keyed by its constant name. */
export type EnumOptionMap = {
  ROLE_STATUS_OPTIONS: EnumOption<RoleStatus>[]
  TASK_STATUS_OPTIONS: EnumOption<TaskStatus>[]
  TASK_PRIORITY_OPTIONS: EnumOption<TaskPriority>[]
}

/**
 * Translated enum choices for controls and filters, e.g.
 * `const { ROLE_STATUS_OPTIONS: statusOptions } = useEnums()`. Values derive
 * from the shared API contract; labels resolve as `<prefix>.<value>`.
 */
export function useEnums(): EnumOptionMap {
  const { t } = useTranslation()

  return useMemo(() => {
    const translate = <T extends string>(
      values: readonly T[],
      prefix: string
    ): EnumOption<T>[] =>
      values.map((value) => ({ value, label: t(`${prefix}.${value}`) }))

    return {
      ROLE_STATUS_OPTIONS: translate(roleStatusSchema.options, "roles.status"),
      TASK_STATUS_OPTIONS: translate(taskStatusSchema.options, "tasks.status"),
      TASK_PRIORITY_OPTIONS: translate(
        taskPrioritySchema.options,
        "tasks.priority"
      ),
    }
  }, [t])
}
