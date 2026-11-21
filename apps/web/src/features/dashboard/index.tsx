import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslation } from "react-i18next"

import { DashboardPageSkeleton } from "@/components/page-skeletons"
import { AssigneeChart } from "./components/assignee-chart"
import { DashboardHeader } from "./components/dashboard-header"
import { KpiCards } from "./components/kpi-cards"
import { TaskPriorityChart } from "./components/task-priority-chart"
import { TaskStatusChart } from "./components/task-status-chart"
import { useTaskSummary } from "./hooks/use-task-summary"

/**
 * The Dashboard: the Task summary, refreshed by Live events. The page owns one
 * Live subscription while mounted; leaving the route closes the stream.
 */
export function DashboardView() {
  const { t } = useTranslation()
  const { summary, isLoading, isError, refetch, liveStatus } = useTaskSummary()

  if (isLoading) return <DashboardPageSkeleton />

  return (
    <main className="flex flex-col gap-6 p-6">
      <DashboardHeader liveStatus={liveStatus} />
      {isError || !summary ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("dashboard.error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void refetch()}>
              {t("dashboard.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <KpiCards totals={summary.totals} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TaskStatusChart summary={summary} />
            <TaskPriorityChart summary={summary} />
          </div>
          <AssigneeChart summary={summary} />
        </>
      )}
    </main>
  )
}
