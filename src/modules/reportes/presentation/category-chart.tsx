"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
  total: {
    label: "Ventas",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export interface CategoryChartProps {
  port: SalesSummaryPort
}

export function CategoryChart({ port }: CategoryChartProps) {
  const { summary, refresh } = useSalesSummary(port)

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Ventas por categoría</CardTitle>
        <CardDescription>Distribución de ingresos del mes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart
            data={summary?.categoryTotals ?? []}
            layout="vertical"
            margin={{ left: 4, right: 12 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              axisLine={false}
              width={110}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
