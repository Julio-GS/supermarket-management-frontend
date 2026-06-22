"use client"

import { reportRepository } from "../infrastructure/report-repository-instance"
import { CategoryChartShell } from "./category-chart-shell"
import { SalesChartShell } from "./sales-chart-shell"
import { TopProducts } from "../presentation/top-products"

export function ReportesShell() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7 lg:gap-6">
        <div className="lg:col-span-4">
          <SalesChartShell />
        </div>
        <div className="lg:col-span-3">
          <CategoryChartShell />
        </div>
      </div>
      <TopProducts port={reportRepository} />
    </div>
  )
}
