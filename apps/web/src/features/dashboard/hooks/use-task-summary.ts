import { useCustom, useSubscription } from "@refinedev/core"
import { useQueryClient } from "@tanstack/react-query"
import type { DashboardSummary } from "@workspace/api/schemas"
import { useCallback, useEffect, useRef } from "react"

import { useLiveStatus } from "@/providers/live-provider"
import { apiUrl } from "@/utils/api-url"

/** Stable key so the Dashboard can invalidate exactly its own query. */
export const TASK_SUMMARY_QUERY_KEY = ["dashboard", "task-summary"] as const

/** Bursts (bulk edits) collapse into one refetch per window. */
const LIVE_COALESCE_MS = 250

/**
 * Reads the Task summary and keeps it live. Refine owns the request through
 * `useCustom`; `useSubscription` registers the SSE channel. Core's live
 * invalidation is resource-wide and is not wired for custom queries, so the
 * callback invalidates the summary key itself, coalesced.
 */
export function useTaskSummary() {
  const queryClient = useQueryClient()
  const liveStatus = useLiveStatus()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { query } = useCustom<DashboardSummary>({
    url: `${apiUrl}/dashboard/summary`,
    method: "get",
    queryOptions: {
      queryKey: TASK_SUMMARY_QUERY_KEY,
      staleTime: 0,
    },
  })

  const invalidate = useCallback(() => {
    if (timer.current !== null) return
    timer.current = setTimeout(() => {
      timer.current = null
      void queryClient.invalidateQueries({ queryKey: TASK_SUMMARY_QUERY_KEY })
    }, LIVE_COALESCE_MS)
  }, [queryClient])

  // `useSubscription` re-subscribes only when `enabled` changes, so this
  // callback is captured once; everything it closes over is stable.
  useSubscription({
    channel: "resources/tasks",
    types: ["created", "updated", "deleted"],
    onLiveEvent: invalidate,
  })

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    []
  )

  return {
    summary: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    liveStatus,
  }
}
