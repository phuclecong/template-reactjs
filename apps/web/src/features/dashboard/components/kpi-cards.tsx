import type { DashboardSummary } from "@workspace/api/schemas"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslation } from "react-i18next"

export function KpiCards({ totals }: { totals: DashboardSummary["totals"] }) {
  const { t, i18n } = useTranslation()

  const completion = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(totals.completionRate)

  const items = [
    { key: "total", label: t("dashboard.kpi.total"), value: totals.total },
    { key: "open", label: t("dashboard.kpi.open"), value: totals.open },
    {
      key: "overdue",
      label: t("dashboard.kpi.overdue"),
      value: totals.overdue,
    },
    {
      key: "completion",
      label: t("dashboard.kpi.completion"),
      value: completion,
    },
  ] as const

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.key} size="sm">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle
              className="text-2xl"
              data-testid={`dashboard-kpi-${item.key}`}
            >
              {item.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
