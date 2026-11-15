// @vitest-environment jsdom
import type { ErrorInfo, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/utils/i18n"
import { ErrorBoundary } from "@/components/error-boundary"

function withI18n(node: ReactNode) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ErrorBoundary", () => {
  it("renders the translated default fallback", () => {
    function Exploding(): ReactNode {
      throw new Error("render failed")
    }

    render(
      withI18n(
        <ErrorBoundary>
          <Exploding />
        </ErrorBoundary>
      )
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText("An unexpected error occurred. Please try again.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
    expect(console.error).toHaveBeenCalled()
  })

  it("renders the translated default fallback without a provider", () => {
    function Exploding(): ReactNode {
      throw new Error("render failed")
    }

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
  })

  it("renders a node fallback when provided", () => {
    function Exploding(): ReactNode {
      throw new Error("render failed")
    }

    render(
      withI18n(
        <ErrorBoundary fallback={<p>Custom fallback</p>}>
          <Exploding />
        </ErrorBoundary>
      )
    )

    expect(screen.getByText("Custom fallback")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("renders a function fallback and recovers when it resets", async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    function Flaky(): ReactNode {
      if (shouldThrow) throw new Error("render failed")
      return <p>Recovered content</p>
    }

    render(
      withI18n(
        <ErrorBoundary
          fallback={({ reset }) => (
            <button type="button" onClick={reset}>
              Reset view
            </button>
          )}
        >
          <Flaky />
        </ErrorBoundary>
      )
    )

    expect(
      screen.getByRole("button", { name: "Reset view" })
    ).toBeInTheDocument()

    shouldThrow = false
    await user.click(screen.getByRole("button", { name: "Reset view" }))

    expect(screen.getByText("Recovered content")).toBeInTheDocument()
  })

  it("passes the caught error and info to onError", () => {
    const thrown = new Error("render failed")
    const onError = vi.fn()

    function Exploding(): ReactNode {
      throw thrown
    }

    render(
      withI18n(
        <ErrorBoundary fallback={<p>Failed</p>} onError={onError}>
          <Exploding />
        </ErrorBoundary>
      )
    )

    expect(onError).toHaveBeenCalledTimes(1)
    const [error, info] = onError.mock.calls[0] as [Error, ErrorInfo]
    expect(error).toBe(thrown)
    expect(info.componentStack).toEqual(expect.any(String))
  })

  it("fires onReset when the default fallback resets", async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    let shouldThrow = true

    function Flaky(): ReactNode {
      if (shouldThrow) throw new Error("render failed")
      return <p>Recovered content</p>
    }

    render(
      withI18n(
        <ErrorBoundary onReset={onReset}>
          <Flaky />
        </ErrorBoundary>
      )
    )

    shouldThrow = false
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Recovered content")).toBeInTheDocument()
  })

  it("normalizes a non-Error throw to an Error", () => {
    let received: unknown
    const onError = vi.fn()

    function Exploding(): ReactNode {
      throw "kaboom"
    }

    render(
      withI18n(
        <ErrorBoundary
          fallback={({ error }) => {
            received = error
            return <p>Failed</p>
          }}
          onError={onError}
        >
          <Exploding />
        </ErrorBoundary>
      )
    )

    expect(received).toBeInstanceOf(Error)
    expect((received as Error).message).toBe("kaboom")
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
  })
})
