import { describe, expect, it } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { RecentSale } from "../../domain/report-read-models"
import type { RecentSalesPort } from "../recent-sales-port"
import { useRecentSales } from "../use-recent-sales"

const fakeRecentSales: RecentSale[] = [
  { id: "V-1", date: "2026-06-21 10:00", customer: "Mostrador", paymentMethod: "Efectivo", total: 10 },
  { id: "V-2", date: "2026-06-21 11:00", customer: "Café", paymentMethod: "Tarjeta", total: 25 },
]

function createFakeRecentSalesPort(): RecentSalesPort {
  return {
    async getRecentSales(limit) {
      return fakeRecentSales.slice(0, limit)
    },
  }
}

describe("useRecentSales", () => {
  it("loads recent sales from the port when refresh is called", async () => {
    const { result } = renderHook(() => useRecentSales(createFakeRecentSalesPort()))

    expect(result.current.sales).toHaveLength(0)
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      await result.current.refresh()
    })

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

    const { result } = renderHook(() => useRecentSales(port))
    await act(async () => {
      await result.current.refresh()
    })

    expect(receivedLimit).toBe(6)
    await waitFor(() => expect(result.current.sales).toHaveLength(2))
  })
})
