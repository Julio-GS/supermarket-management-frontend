import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiPromotionRepository } from "../api-promotion-repository"
import type { Promotion } from "../../domain/promotion"

vi.mock("@/shared/infrastructure/auth-token-store", () => ({
  getAccessToken: vi.fn(() => "token123"),
  clearAccessToken: vi.fn(),
}))

function getFetchMock() {
  return vi.mocked(fetch)
}

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-1",
    name: "Promo verano",
    description: "Descuento de temporada",
    type: "percentage",
    discount_percent: 10,
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-31T00:00:00.000Z",
    weekdays: null,
    active: true,
    productIds: ["P001"],
    ...overrides,
  }
}

describe("ApiPromotionRepository", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches the promotion list from the backend", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify([makePromotion()]), { status: 200 })
    )

    const repository = new ApiPromotionRepository()
    const promotions = await repository.getPromotions()

    expect(promotions).toHaveLength(1)
    expect(promotions[0].name).toBe("Promo verano")

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions")
  })

  it("sends POST requests when creating promotions", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(makePromotion({ id: "promo-2" })), { status: 201 })
    )

    const repository = new ApiPromotionRepository()
    const payload: Omit<Promotion, "id"> = {
      name: "Promo nueva",
      description: "Nuevo descuento",
      type: "percentage",
      discount_percent: 15,
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-31T00:00:00.000Z",
      weekdays: null,
      active: true,
      productIds: ["P002"],
    }

    const created = await repository.createPromotion(payload)

    expect(created.id).toBe("promo-2")

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual(payload)
  })

  it("sends PUT requests when updating promotions", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify(makePromotion({ name: "Promo actualizada" })), { status: 200 })
    )

    const repository = new ApiPromotionRepository()
    const patch: Partial<Promotion> = { name: "Promo actualizada", active: false }

    const updated = await repository.updatePromotion("promo-1", patch)

    expect(updated.name).toBe("Promo actualizada")

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions/promo-1")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toEqual(patch)
  })

  it("sends DELETE requests when deactivating promotions", async () => {
    getFetchMock().mockResolvedValue(new Response(null, { status: 204 }))

    const repository = new ApiPromotionRepository()
    await repository.deletePromotion("promo-1")

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions/promo-1")
    expect(options?.method).toBe("DELETE")
    expect(options?.body).toBeUndefined()
  })
})
