import { describe, expect, it } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type {
  ReportStats,
  SalesSummary,
} from "../../domain/report-read-models"
import type { SalesSummaryPort } from "../sales-summary-port"
import { useSalesSummary } from "../use-sales-summary"

const fakeSummary: SalesSummary = {
  salesByDay: [{ day: "Lun", sales: 1000, transactions: 10 }],
  categoryTotals: [{ category: "Bebidas", total: 500 }],
}

const fakeStats: ReportStats = {
  monthlyRevenue: 1000,
  averageTicket: 10,
  grossMargin: 20,
  annualGrowth: 5,
}

function createFakeSalesSummaryPort(): SalesSummaryPort {
  return {
    async getSalesSummary() {
      return fakeSummary
    },
    async getReportStats() {
      return fakeStats
    },
  }
}

describe("useSalesSummary", () => {
  it("loads sales summary and stats from the port", async () => {
    const { result } = renderHook(() => useSalesSummary(createFakeSalesSummaryPort()))

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary?.salesByDay).toHaveLength(1)
    expect(result.current.summary?.categoryTotals).toHaveLength(1)
    expect(result.current.stats?.monthlyRevenue).toBe(1000)
    expect(result.current.error).toBeNull()
  })
})
