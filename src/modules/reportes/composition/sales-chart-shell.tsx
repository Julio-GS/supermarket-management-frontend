"use client"

import * as React from "react"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { reportRepository } from "../infrastructure/report-repository-instance"

const SalesChart = React.lazy(() =>
  import("../presentation/sales-chart").then((mod) => ({ default: mod.SalesChart }))
)

function ChartSkeleton() {
  return (
    <div
      data-testid="chart-skeleton"
      aria-busy="true"
      className="flex flex-col rounded-xl border bg-card p-6"
    >
      <div className="mb-2 space-y-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  )
}

export function SalesChartShell() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <SalesChart port={reportRepository} />
    </Suspense>
  )
}
