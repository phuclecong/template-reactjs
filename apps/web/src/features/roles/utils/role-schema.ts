import { z } from "zod"
import {
  roleStatusSchema,
  type RoleStatus,
} from "@workspace/api/schemas"

/** Title and description limits are part of the Role contract. */
export const ROLE_TITLE_MAX = 100
export const ROLE_DESCRIPTION_MAX = 500

export type RoleFormMessages = {
  titleRequired: string
  titleTooLong: string
  descriptionTooLong: string
}

/**
 * The single set of Role field validators shared by create, edit, and bulk
 * edit. Messages are injected so the same schema runs in the active locale.
 *
 * `.trim()` sits before the length checks, so whitespace-only titles are blank
 * and over-length values are measured after trimming.
 */
export function roleTitleSchema(messages: RoleFormMessages) {
  return z
    .string()
    .trim()
    .min(1, messages.titleRequired)
    .max(ROLE_TITLE_MAX, messages.titleTooLong)
}

/**
 * The edit prefill normalizes a `null` description to an empty string before
 * this schema sees it, so the validator and the form share one string shape.
 */
export function roleDescriptionSchema(messages: RoleFormMessages) {
  return z
    .string()
    .trim()
    .max(ROLE_DESCRIPTION_MAX, messages.descriptionTooLong)
}

/** The create/edit form shape. Bulk edit reuses the field schemas above. */
export function createRoleFormSchema(messages: RoleFormMessages) {
  return z.object({
    title: roleTitleSchema(messages),
    description: roleDescriptionSchema(messages),
    status: roleStatusSchema,
  })
}

export type RoleFormValues = z.infer<ReturnType<typeof createRoleFormSchema>>

/**
 * The bulk edit form shape. Titles are absent because they are unique, and an
 * untouched status is the empty string. Field validation comes from the same
 * shared validators as create/edit.
 */
export function createRoleBulkFormSchema(messages: RoleFormMessages) {
  return z.object({
    description: roleDescriptionSchema(messages),
    status: z.union([z.literal(""), roleStatusSchema]),
  })
}

/** A create or partial edit payload sent to the Roles data provider. */
export type RoleWritePayload = {
  title?: string
  description?: string | null
  status?: RoleStatus
}

/** Shared normalization: a blank or whitespace-only description is `null`. */
export function normalizeRoleDescription(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim()
  return trimmed === "" ? null : trimmed
}

export function emptyRoleFormValues(): RoleFormValues {
  return { title: "", description: "", status: "active" }
}

/** Create sends every editable field. */
export function toCreateRolePayload(
  values: RoleFormValues
): RoleWritePayload {
  return {
    title: values.title.trim(),
    description: normalizeRoleDescription(values.description),
    status: values.status,
  }
}

/**
 * Edit sends only the fields the Administrator changed. The Role id and the
 * server-managed timestamps are never part of the form, so they cannot be
 * submitted.
 */
export function toDirtyRolePayload(
  values: RoleFormValues,
  dirtyFields: Partial<Record<keyof RoleFormValues, boolean>>
): RoleWritePayload {
  const payload: RoleWritePayload = {}
  if (dirtyFields.title) payload.title = values.title.trim()
  if (dirtyFields.description) {
    payload.description = normalizeRoleDescription(values.description)
  }
  if (dirtyFields.status) payload.status = values.status
  return payload
}
