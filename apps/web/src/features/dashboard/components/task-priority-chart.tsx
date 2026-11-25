import type { DashboardSummary } from "@workspace/api/schemas"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import { useTranslation } from "react-i18next"
import { Cell, Pie, PieChart } from "recharts"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { PRIORITY_COLORS } from "../utils/chart-colors"
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
    fill: `var(--color-${priority})`,
  }))
  const config = Object.fromEntries(
    summary.byPriority.map(({ priority }) => [
      priority,
      { label: t(LABEL_KEYS[priority]), color: PRIORITY_COLORS[priority] },
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
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="priority" />}
                />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="priority"
                  // innerRadius={48}
                  // outerRadius={88}
                  stroke="var(--card)"
                  strokeWidth={0}
                  isAnimationActive={!reducedMotion}
                >
                  {data.map((entry) => (
                    <Cell key={entry.priority} fill={entry.fill} />
                  ))}
                </Pie>
                {/* Recharts sorts legend items by value by default, which
                    would scramble the low→medium→high ramp order. */}
                <ChartLegend
                  itemSorter={null}
                  content={<ChartLegendContent nameKey="priority" />}
                />
              </PieChart>
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
