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

const UNASSIGNED = "unassigned"

export function AssigneeChart({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const data = summary.byAssignee.map((entry) => ({
    key: entry.assigneeId ?? UNASSIGNED,
    label: entry.assigneeId === null ? t("dashboard.unassigned") : entry.name,
    count: entry.count,
  }))
  const config = Object.fromEntries(
    data.map((entry) => [
      entry.key,
      { label: entry.label, color: "var(--chart-1)" },
    ])
  ) satisfies ChartConfig

  const title = t("dashboard.charts.byAssignees")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
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
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 32, left: 8 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={132}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) =>
                    value.length > 18 ? `${value.slice(0, 17)}…` : value
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      nameKey="key"
                      color="var(--chart-1)"
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={!reducedMotion}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
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
