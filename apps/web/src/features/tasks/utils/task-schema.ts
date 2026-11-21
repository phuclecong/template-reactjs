import { z } from "zod"
import {
  taskPrioritySchema,
  taskStatusSchema,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
} from "@workspace/api/schemas"
import {
  normalizeLegacyDateValue,
  toUtcInstant,
} from "@workspace/ui/lib/date"

export type TaskFormMessages = {
  titleRequired: string
}

/**
 * The create/edit form shape. Messages are injected so the schema runs in the
 * active locale; the other fields are constrained by the contract enums or
 * normalized by `toPayload`.
 */
export function createTaskFormSchema(messages: TaskFormMessages) {
  return z.object({
    title: z.string().min(1, messages.titleRequired),
    description: z.string(),
    status: taskStatusSchema,
    priority: z.union([taskPrioritySchema, z.literal("")]),
    assigneeId: z.string(),
    dueDate: z.string(),
  })
}

export type TaskFormValues = z.infer<ReturnType<typeof createTaskFormSchema>>

/** The fields the write path sends when creating or updating a Task. */
export type TaskWritePayload = {
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority | null
  assigneeId: string | null
  dueDate: string | null
}

/**
 * Convert a stored Due date to the form value the DatePicker edits: the UTC
 * instant itself, with legacy date-only records normalized to local midnight.
 */
export function dueDateToFormValue(dueDate: string | null | undefined): string {
  return normalizeLegacyDateValue(dueDate) ?? ""
}

/**
 * Convert the form value back to the UTC instant the API stores. The picker
 * emits instants; a date-only value is rejected (null) rather than silently
 * normalized, because new writes must be date-time instants. Empty clears
 * the Due date.
 */
export function formValueToDueDate(value: string): string | null {
  return toUtcInstant(value)
}

/** The edit prefill comes from the table row; the detail request is skipped. */
export function toTaskFormValues(task: TaskRecord | null): TaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      status: "todo",
      priority: "",
      assigneeId: "",
      dueDate: "",
    }
  }
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority ?? "",
    assigneeId: task.assigneeId ?? "",
    dueDate: dueDateToFormValue(task.dueDate),
  }
}

/** Empty optional fields are sent as `null`, never as empty strings. */
export function toTaskPayload(values: TaskFormValues): TaskWritePayload {
  return {
    title: values.title.trim(),
    description: values.description.trim() === "" ? null : values.description,
    status: values.status,
    priority: values.priority === "" ? null : values.priority,
    assigneeId: values.assigneeId === "" ? null : values.assigneeId,
    dueDate: formValueToDueDate(values.dueDate),
  }
}
