"use client"

import { reportRepository } from "../infrastructure/report-repository-instance"
import { CategoryChart } from "../presentation/category-chart"

export function CategoryChartShell() {
  return <CategoryChart port={reportRepository} />
}
