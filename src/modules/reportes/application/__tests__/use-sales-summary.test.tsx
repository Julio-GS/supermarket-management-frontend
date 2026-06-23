import { describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderHook } from "@/test/render"
import type {
  ReportStats,
  SalesSummary,
} from "../../domain/report-read-models"
import type { SalesSummaryPort } from "../sales-summary-port"
import { useSalesSummary } from "../use-sales-summary"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  })
}

function renderHookWithClient<TProps, TResult>(
  hook: (props: TProps) => TResult,
  client: QueryClient
) {
  return rtlRenderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

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
  it("loads sales summary and stats from the port on mount", async () => {
    const { result } = renderHook(() => useSalesSummary(createFakeSalesSummaryPort()))

    await waitFor(() => expect(result.current.summary).not.toBeNull())
    expect(result.current.summary?.salesByDay).toHaveLength(1)
    expect(result.current.summary?.categoryTotals).toHaveLength(1)
    expect(result.current.stats?.monthlyRevenue).toBe(1000)
    expect(result.current.error).toBeNull()
  })

  it("shares the cache key so the ports are called once for two consumers", async () => {
    const getSalesSummary = vi.fn(async () => fakeSummary)
    const getReportStats = vi.fn(async () => fakeStats)
    const port: SalesSummaryPort = { getSalesSummary, getReportStats }
    const client = createQueryClient()

    renderHookWithClient(() => useSalesSummary(port), client)
    renderHookWithClient(() => useSalesSummary(port), client)

    await waitFor(() => expect(getSalesSummary).toHaveBeenCalledTimes(1))
    expect(getReportStats).toHaveBeenCalledTimes(1)
  })
})
