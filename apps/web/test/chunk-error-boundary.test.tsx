// @vitest-environment jsdom
import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import i18n from "@/utils/i18n"
import { CHUNK_RELOAD_MARKER, type ChunkModule } from "@/utils/lazy-with-retry"
import { ChunkErrorBoundary } from "@/components/chunk-error-boundary"
import { RetryableLazy } from "@/components/retryable-lazy"

function withI18n(node: ReactNode) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
}

beforeEach(async () => {
  await i18n.changeLanguage("en")
  // Pretend the automatic reload already happened: these tests observe the
  // boundary and the retry action, not a real navigation.
  window.sessionStorage.setItem(CHUNK_RELOAD_MARKER, "1")
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe("ChunkErrorBoundary", () => {
  it("renders a translated retry action instead of a blank screen", () => {
    function Exploding(): ReactNode {
      throw new Error("chunk 404")
    }

    render(
      withI18n(
        <ChunkErrorBoundary>
          <Exploding />
        </ChunkErrorBoundary>
      )
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
  })

  it("re-attempts rendering when the user retries", async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    function Flaky(): ReactNode {
      if (shouldThrow) throw new Error("chunk 404")
      return <p>Recovered content</p>
    }

    render(
      withI18n(
        <ChunkErrorBoundary
          onRetry={() => {
            shouldThrow = false
          }}
        >
          <Flaky />
        </ChunkErrorBoundary>
      )
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(screen.getByText("Recovered content")).toBeInTheDocument()
  })
})

describe("RetryableLazy", () => {
  it("renders the lazy component once its module loads", async () => {
    function Loaded() {
      return <p>Loaded overlay</p>
    }
    const loader = async (): Promise<ChunkModule<typeof Loaded>> => ({
      default: Loaded,
    })

    render(withI18n(<RetryableLazy loader={loader} props={{}} />))

    expect(await screen.findByText("Loaded overlay")).toBeInTheDocument()
  })

  it("shows the retry action for a failed chunk and recovers on a fresh attempt", async () => {
    const user = userEvent.setup()
    let failing = true

    function Recovered() {
      return <p>Recovered overlay</p>
    }
    const loader = async (): Promise<ChunkModule<typeof Recovered>> => {
      if (failing) throw new Error("chunk 404")
      return { default: Recovered }
    }

    render(withI18n(<RetryableLazy loader={loader} props={{}} />))

    expect(
      await screen.findByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Recovered overlay")).not.toBeInTheDocument()

    failing = false
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Recovered overlay")).toBeInTheDocument()
  })
})
