"use client"

import { reportRepository } from "../infrastructure/report-repository-instance"
import { LowStock } from "../presentation/low-stock"

export function LowStockShell() {
  return <LowStock port={reportRepository} />
}
