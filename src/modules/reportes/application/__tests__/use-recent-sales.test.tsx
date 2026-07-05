import { describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderHook } from "@/test/render"
import type { RecentSale } from "../../domain/report-read-models"
import type { RecentSalesPort } from "../recent-sales-port"
import { useRecentSales } from "../use-recent-sales"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        refetchOnWindowFocus: true,
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

const fakeRecentSales: RecentSale[] = [
  { id: "V-1", date: "2026-06-21T10:00:00.000Z", customer: "Mostrador", paymentMethods: [{ method: "cash", amount: "10.00" }], total: "10.00" },
  { id: "V-2", date: "2026-06-21T11:00:00.000Z", customer: "Café", paymentMethods: [{ method: "card", amount: "25.00" }], total: "25.00" },
]

function createFakeRecentSalesPort(): RecentSalesPort {
  return {
    async getRecentSales(limit) {
      return fakeRecentSales.slice(0, limit)
    },
  }
}

describe("useRecentSales", () => {
  it("loads recent sales from the port on mount", async () => {
    const { result } = renderHook(() => useRecentSales(createFakeRecentSalesPort()))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.sales).toHaveLength(2))
    expect(result.current.sales[0].id).toBe("V-1")
    expect(result.current.error).toBeNull()
  })

  it("passes the default limit to the port", async () => {
    let receivedLimit = 0
    const port: RecentSalesPort = {
      async getRecentSales(limit) {
        receivedLimit = limit ?? 0
        return fakeRecentSales.slice(0, limit)
      },
    }

    renderHook(() => useRecentSales(port))

    await waitFor(() => expect(receivedLimit).toBe(6))
  })

  it("shares the cache key so the port is called once for two consumers", async () => {
    const getRecentSales = vi.fn(async (limit: number | undefined) => fakeRecentSales.slice(0, limit))
    const port: RecentSalesPort = { getRecentSales }
    const client = createQueryClient()

    renderHookWithClient(() => useRecentSales(port), client)
    renderHookWithClient(() => useRecentSales(port), client)

    await waitFor(() => expect(getRecentSales).toHaveBeenCalledTimes(1))
  })

  it("inherits global refetch-on-focus defaults", async () => {
    const client = createQueryClient()

    const { result } = renderHookWithClient(() => {
      const queryClient = useQueryClient()
      return queryClient.getDefaultOptions().queries?.refetchOnWindowFocus
    }, client)

    expect(result.current).toBe(true)
  })
})
