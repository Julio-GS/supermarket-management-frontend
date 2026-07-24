import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test.example.com/api/v1"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function desktopPromotionResult() {
  return {
    success: true as const,
    promotion: {
      id: "promo-1",
      name: "Late desktop promo",
      description: null,
      scope: "store",
      productId: null,
      type: "percentage",
      discountPercent: 10,
      startDate: null,
      endDate: null,
      weekdays: null,
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }
}

function stubDesktopBridge(results = [desktopPromotionResult()]) {
  vi.stubGlobal("window", {
    marketDesktop: {
      promotions: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockResolvedValue(results),
      },
    },
  })
}

function clearDesktopBridge() {
  vi.stubGlobal("window", undefined)
}

async function getRepository() {
  const mod = await import("../promotion-repository-instance")
  return mod.promotionRepository
}

describe("promotionRepository lazy desktop resolution", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal("fetch", mockFetch)
    vi.resetModules()
    clearDesktopBridge()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses desktop bridge when it becomes available after import", async () => {
    const repo = await getRepository()

    stubDesktopBridge()

    const promotions = await repo.getPromotions()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(promotions).toHaveLength(1)
    expect(promotions[0].name).toBe("Late desktop promo")
  })

  it("falls back to API when desktop bridge never appears", async () => {
    const repo = await getRepository()

    mockFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    const promotions = await repo.getPromotions()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(promotions).toEqual([])
  })
})
