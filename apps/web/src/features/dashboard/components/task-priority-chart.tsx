import type { DashboardSummary } from "@workspace/api/schemas"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { ChartDataTable } from "./chart-data-table"

const LABEL_KEYS = {
  low: "dashboard.priority.low",
  medium: "dashboard.priority.medium",
  high: "dashboard.priority.high",
  unassigned: "dashboard.priority.unassigned",
} as const

export function TaskPriorityChart({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const data = summary.byPriority.map(({ priority, count }) => ({
    priority,
    label: t(LABEL_KEYS[priority]),
    count,
  }))
  const config = Object.fromEntries(
    summary.byPriority.map(({ priority }) => [
      priority,
      { label: t(LABEL_KEYS[priority]), color: "var(--chart-1)" },
    ])
  ) satisfies ChartConfig

  const title = t("dashboard.charts.byPriority")
  const isEmpty = data.every((entry) => entry.count === 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("dashboard.charts.empty")}
          </p>
        ) : (
          <>
            <ChartContainer
              config={config}
              className="aspect-auto h-64 w-full"
              aria-hidden="true"
            >
              <BarChart data={data} margin={{ top: 20, right: 8, left: -16 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      nameKey="priority"
                      color="var(--chart-1)"
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reducedMotion}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill="var(--muted-foreground)"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
            <ChartDataTable
              caption={title}
              rows={data.map(({ label, count }) => ({ label, count }))}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
