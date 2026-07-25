import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test.example.com/api/v1"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

async function getStockRepository() {
  const mod = await import("../stock-repository-instance")
  return mod.stockRepository
}

describe("stockRepository", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.resetModules()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the desktop bridge for stock adjustments when available", async () => {
    const adjust = vi.fn().mockResolvedValue({
      id: "mov-1",
      productId: "prod-1",
      quantity: 5,
      type: "adjustment",
      referenceId: null,
      previousStock: 10,
      newStock: 15,
      reason: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    vi.stubGlobal("window", {
      marketDesktop: {
        getConfig: () => ({ apiBaseUrl: "https://api.test.example.com/api/v1" }),
        stock: {
          get: vi.fn().mockResolvedValue(10),
          adjust,
        },
      },
    })

    const repo = await getStockRepository()
    const movement = await repo.adjust({ productId: "prod-1", quantity: 5, reason: "manual" })

    expect(adjust).toHaveBeenCalledWith({ productId: "prod-1", quantity: 5, reason: "manual" })
    expect(movement.newStock).toBe(15)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
