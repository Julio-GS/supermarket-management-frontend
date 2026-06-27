"use client"

import { reportRepository } from "../infrastructure/report-repository-instance"
import { SalesChartShell } from "./sales-chart-shell"
import { TopProducts } from "../presentation/top-products"

export function ReportesShell() {
  return (
    <div className="flex flex-col gap-4">
      <SalesChartShell />
      <TopProducts port={reportRepository} />
    </div>
  )
}
