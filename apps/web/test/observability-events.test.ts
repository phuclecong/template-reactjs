import { afterEach, describe, expect, it } from "vitest"

import { setSink, track } from "@/observability"
import type { Entry } from "@/observability"

afterEach(() => {
  setSink()
})

describe("track", () => {
  it("emits an event entry with the event name and data", () => {
    const entries: Entry[] = []
    setSink((entry) => entries.push(entry))

    track("task.created", { taskId: "task-1" })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      kind: "event",
      level: "info",
      event: "task.created",
      data: { taskId: "task-1" },
      context: {
        sessionId: expect.any(String),
        path: "",
        userAgent: expect.any(String),
        env: "test",
      },
    })
  })
})
