"use client"

import { reportRepository } from "../infrastructure/report-repository-instance"
import { RecentSales } from "../presentation/recent-sales"

export function RecentSalesShell() {
  return <RecentSales port={reportRepository} />
}
