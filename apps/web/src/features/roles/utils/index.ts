/** Administrator identity is holding the `rol_admin` System Role. */
export function isAdministrator(
  user: { roleId: string } | null | undefined
): boolean {
  return user?.roleId === "rol_admin"
}

/**
 * Formats a server instant in the runtime's local timezone as
 * `YYYY-MM-DD HH:mm`. The Roles table deliberately uses a fixed, unambiguous
 * shape rather than locale month names so the two supported locales render the
 * same timestamp layout.
 */
export function formatLocalDateTime(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
