import { describe, expect, it } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { LowStockProduct } from "../../domain/report-read-models"
import type { LowStockPort } from "../low-stock-port"
import { useLowStock } from "../use-low-stock"

const fakeLowStockProducts: LowStockProduct[] = [
  { id: "P001", name: "Leche", category: "Lácteos", stock: 5, stockMinimum: 20, unit: "u" },
]

function createFakeLowStockPort(): LowStockPort {
  return {
    async getLowStockProducts() {
      return fakeLowStockProducts
    },
  }
}

describe("useLowStock", () => {
  it("loads low stock products from the port when refresh is called", async () => {
    const { result } = renderHook(() => useLowStock(createFakeLowStockPort()))

    expect(result.current.products).toHaveLength(0)

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.products).toHaveLength(1))
    expect(result.current.products[0].name).toBe("Leche")
    expect(result.current.error).toBeNull()
  })
})
