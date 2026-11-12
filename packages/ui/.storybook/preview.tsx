import type { Decorator, Preview } from "@storybook/react"
import { useEffect, type ReactNode } from "react"

import "../src/styles/globals.css"

/**
 * Global light/dark theme toolbar. The design system's tokens are
 * class-based (`.dark`), so the toolbar toggles that class on the preview
 * document. Applying it to `<html>` (rather than only a wrapper) also themes
 * portalled overlays such as popovers and sheets.
 */
function ThemedCanvas({
  theme,
  children,
}: {
  theme: "light" | "dark"
  children: ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    return () => root.classList.remove("dark")
  }, [theme])

  return (
    <div
      className={`min-h-screen bg-background p-8 text-foreground antialiased ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      {children}
    </div>
  )
}

const withTheme: Decorator = (Story, context) => (
  <ThemedCanvas theme={context.globals.theme === "dark" ? "dark" : "light"}>
    <Story />
  </ThemedCanvas>
)

/**
 * Shared Storybook preview. Renders every story on the design system's
 * background so token-driven classes (`bg-background`, `text-foreground`,
 * `border-border`, …) are visible exactly as they appear in the app.
 */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Toggle the design system light and dark theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [withTheme],
}

export default preview
