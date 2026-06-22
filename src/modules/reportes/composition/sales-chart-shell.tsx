"use client"

import { reportRepository } from "../infrastructure/report-repository-instance"
import { SalesChart } from "../presentation/sales-chart"

export function SalesChartShell() {
  return <SalesChart port={reportRepository} />
}
