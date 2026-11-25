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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { STATUS_COLORS } from "../utils/chart-colors"
import { ChartDataTable } from "./chart-data-table"

const LABEL_KEYS = {
  todo: "dashboard.status.todo",
  "in-progress": "dashboard.status.in-progress",
  done: "dashboard.status.done",
  blocked: "dashboard.status.blocked",
} as const

export function TaskStatusChart({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const data = summary.byStatus.map(({ status, count }) => ({
    status,
    label: t(LABEL_KEYS[status]),
    count,
    fill: `var(--color-${status})`,
  }))
  const config = Object.fromEntries(
    summary.byStatus.map(({ status }) => [
      status,
      { label: t(LABEL_KEYS[status]), color: STATUS_COLORS[status] },
    ])
  ) satisfies ChartConfig

  const title = t("dashboard.charts.byStatus")
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
                  content={<ChartTooltipContent hideLabel nameKey="status" />}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reducedMotion}
                >
                  {data.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
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
