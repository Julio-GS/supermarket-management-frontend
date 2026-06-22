"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useEffect } from "react"
import type { SalesSummaryPort } from "../application/sales-summary-port"
import { useSalesSummary } from "../application/use-sales-summary"

const chartConfig = {
  sales: {
    label: "Ventas",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export interface SalesChartProps {
  port: SalesSummaryPort
}

export function SalesChart({ port }: SalesChartProps) {
  const { summary, refresh } = useSalesSummary(port)

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Ventas de la semana</CardTitle>
        <CardDescription>Ingresos diarios (EUR) de los últimos 7 días</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={summary?.salesByDay ?? []} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              tickFormatter={(v) => `${v / 1000}k`}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Area
              dataKey="sales"
              type="monotone"
              fill="url(#fillVentas)"
              stroke="var(--color-sales)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
