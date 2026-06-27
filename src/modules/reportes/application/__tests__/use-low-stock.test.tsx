import { describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderHook } from "@/test/render"
import type { LowStockProduct } from "../../domain/report-read-models"
import type { LowStockPort } from "../low-stock-port"
import { useLowStock } from "../use-low-stock"

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

const fakeLowStockProducts: LowStockProduct[] = [
  { id: "P001", name: "Leche", stock: 5, stockMinimum: 20, unit: "u" },
]

function createFakeLowStockPort(): LowStockPort {
  return {
    async getLowStockProducts() {
      return fakeLowStockProducts
    },
  }
}

describe("useLowStock", () => {
  it("loads low stock products from the port on mount", async () => {
    const { result } = renderHook(() => useLowStock(createFakeLowStockPort()))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Leche")
    expect(result.current.error).toBeNull()
  })

  it("shares the cache key so the port is called once for two consumers", async () => {
    const getLowStockProducts = vi.fn(async () => fakeLowStockProducts)
    const port: LowStockPort = { getLowStockProducts }
    const client = createQueryClient()

    renderHookWithClient(() => useLowStock(port), client)
    renderHookWithClient(() => useLowStock(port), client)

    await waitFor(() => expect(getLowStockProducts).toHaveBeenCalledTimes(1))
  })
})
