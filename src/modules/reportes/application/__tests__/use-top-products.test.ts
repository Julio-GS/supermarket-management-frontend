import { describe, expect, it } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { TopProduct } from "../../domain/report-read-models"
import type { TopProductsPort } from "../top-products-port"
import { useTopProducts } from "../use-top-products"

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
  it("loads top products from the port when refresh is called", async () => {
    const { result } = renderHook(() => useTopProducts(createFakeTopProductsPort()))

    expect(result.current.products).toHaveLength(0)
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      await result.current.refresh()
    })

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

    const { result } = renderHook(() => useTopProducts(port))
    await act(async () => {
      await result.current.refresh()
    })

    expect(receivedLimit).toBe(5)
    await waitFor(() => expect(result.current.products).toHaveLength(2))
  })
})
