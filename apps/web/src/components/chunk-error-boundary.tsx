import { Component, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

function ChunkErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 p-4 text-sm"
      // Inline rather than a new utility so the render-blocking stylesheet
      // stays the same size for an error-only surface.
      style={{ alignItems: "flex-start" }}
    >
      <p className="font-medium">{t("error.title")}</p>
      <p className="text-muted-foreground">{t("error.body")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("error.retry")}
      </Button>
    </div>
  )
}

type ChunkErrorBoundaryProps = {
  children: ReactNode
  /**
   * Called after the boundary clears its error, so a caller can discard the
   * failed lazy component and create a fresh one. Without it the same lazy
   * component (and its cached rejection) would render again.
   */
  onRetry?: () => void
}

type ChunkErrorBoundaryState = {
  hasError: boolean
}

/**
 * Catches render-time chunk failures (a rejecting `React.lazy`) and renders a
 * translated retry action instead of a blank surface. It is a class component
 * because error boundaries have no hook equivalent; no error-boundary
 * dependency is added.
 */
export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true }
  }

  private readonly retry = () => {
    this.props.onRetry?.()
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <ChunkErrorFallback onRetry={this.retry} />
    }

    return this.props.children
  }
}
