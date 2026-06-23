import { describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHook as rtlRenderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderHook } from "@/test/render"
import type { TopProduct } from "../../domain/report-read-models"
import type { TopProductsPort } from "../top-products-port"
import { useTopProducts } from "../use-top-products"

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

const fakeTopProducts: TopProduct[] = [
  { name: "Leche", units: 100, revenue: 110 },
  { name: "Pan", units: 80, revenue: 168 },
]

function createFakeTopProductsPort(): TopProductsPort {
  return {
    async getTopProducts(limit) {
      return fakeTopProducts.slice(0, limit)
    },
  }
}

describe("useTopProducts", () => {
  it("loads top products from the port on mount", async () => {
    const { result } = renderHook(() => useTopProducts(createFakeTopProductsPort()))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.products).toHaveLength(2))
    expect(result.current.products[0].name).toBe("Leche")
    expect(result.current.error).toBeNull()
  })

  it("passes the limit to the port", async () => {
    let receivedLimit = 0
    const port: TopProductsPort = {
      async getTopProducts(limit) {
        receivedLimit = limit ?? 0
        return fakeTopProducts.slice(0, limit)
      },
    }

    renderHook(() => useTopProducts(port))

    await waitFor(() => expect(receivedLimit).toBe(5))
  })

  it("shares the cache key so the port is called once for two consumers", async () => {
    const getTopProducts = vi.fn(async (limit: number | undefined) => fakeTopProducts.slice(0, limit))
    const port: TopProductsPort = { getTopProducts }
    const client = createQueryClient()

    renderHookWithClient(() => useTopProducts(port), client)
    renderHookWithClient(() => useTopProducts(port), client)

    await waitFor(() => expect(getTopProducts).toHaveBeenCalledTimes(1))
  })
})
