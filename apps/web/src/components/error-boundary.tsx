import { Component, type ErrorInfo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@workspace/ui/components/button"

import { normalizeError } from "@/utils/error-reporting"

function DefaultErrorFallback({ onReset }: { onReset: () => void }) {
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
      <Button type="button" variant="outline" size="sm" onClick={onReset}>
        {t("error.retry")}
      </Button>
    </div>
  )
}

type ErrorFallbackProps = {
  error: Error
  reset: () => void
}

type ErrorBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode)
  onError?: (error: Error, info: ErrorInfo) => void
  onReset?: () => void
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: normalizeError(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(normalizeError(error), info)
  }

  private readonly reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state

    if (error !== null) {
      const { fallback } = this.props

      if (typeof fallback === "function") {
        return fallback({ error, reset: this.reset })
      }

      if (fallback !== undefined) {
        return fallback
      }

      return <DefaultErrorFallback onReset={this.reset} />
    }

    return this.props.children
  }
}
