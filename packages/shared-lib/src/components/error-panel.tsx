import { Button } from "@workspace/ui/components/button"

export type ErrorPanelProps = {
  /** Translated summary of what failed, for example "Could not load roles." */
  title: string
  /** Optional translated detail, typically the API's error message. */
  description?: string
  /** Translated retry control label. */
  retryLabel: string
  onRetry: () => void
  /** Disables retry while a retry request is already in flight. */
  isRetrying?: boolean
}

/**
 * Inline failure surface for a list that keeps the page shell in place and
 * offers retry instead of blanking the screen. Purely presentational: the
 * caller supplies the translated copy and the retry wiring.
 */
export function ErrorPanel({
  title,
  description,
  retryLabel,
  onRetry,
  isRetrying = false,
}: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRetrying}
        onClick={onRetry}
      >
        {retryLabel}
      </Button>
    </div>
  )
}
