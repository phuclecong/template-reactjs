import { Button } from "@workspace/ui/components/button"

type EmptyListAction = {
  /** Translated control label, for example "Create role". */
  label: string
  onClick: () => void
}

export type EmptyListProps = {
  /** Translated primary message, for example "No roles found." */
  title: string
  /** Optional translated hint explaining what will appear here. */
  description?: string
  /**
   * Optional call to action. Omit it when the current user cannot act on the
   * empty list; the component renders the message alone.
   */
  action?: EmptyListAction
}

/**
 * Empty-list placeholder. Purely presentational: the caller supplies the
 * translated copy and decides whether an action is available, keeping the
 * component independent of any feature's access rules or translation keys.
 */
export function EmptyList({ title, description, action }: EmptyListProps) {
  return (
    <div className="flex flex-col items-center gap-3 border border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <Button type="button" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
