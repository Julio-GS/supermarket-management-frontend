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
      new Response(JSON.stringify([{
        id: "promo-1",
        name: "Promo verano",
        description: "Descuento de temporada",
        scope: "product",
        product_id: "P001",
        type: "percentage",
        discount_percent: 10,
        start_date: "2026-07-01T00:00:00.000Z",
        end_date: "2026-07-31T00:00:00.000Z",
        weekdays: null,
        enabled: true,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      }]), { status: 200 })
    )

    const repository = new ApiPromotionRepository()
    const promotions = await repository.getPromotions()

    expect(promotions).toHaveLength(1)
    expect(promotions[0].name).toBe("Promo verano")
    expect(promotions[0].enabled).toBe(true)
    expect(promotions[0].scope).toBe("product")
    expect(promotions[0].productId).toBe("P001")

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions")
  })

  it("sends POST requests when creating promotions", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({
        id: "promo-2",
        name: "Promo nueva",
        description: "Nuevo descuento",
        scope: "product",
        product_id: "P002",
        type: "percentage",
        discount_percent: 15,
        start_date: "2026-08-01T00:00:00.000Z",
        end_date: "2026-08-31T00:00:00.000Z",
        weekdays: null,
        enabled: true,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      }), { status: 201 })
    )

    const repository = new ApiPromotionRepository()
    const payload: Omit<Promotion, "id" | "createdAt" | "updatedAt"> = {
      name: "Promo nueva",
      description: "Nuevo descuento",
      scope: "product",
      type: "percentage",
      discountPercent: 15,
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-31T00:00:00.000Z",
      weekdays: null,
      enabled: true,
      productId: "P002",
    }

    const created = await repository.createPromotion(payload)

    expect(created.id).toBe("promo-2")

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
      name: "Promo nueva",
      description: "Nuevo descuento",
      scope: "product",
      product_id: "P002",
      type: "percentage",
      discount_percent: 15,
      start_date: "2026-08-01T00:00:00.000Z",
      end_date: "2026-08-31T00:00:00.000Z",
      weekdays: null,
    })
  })

  it("sends PUT requests when updating promotions", async () => {
    getFetchMock().mockResolvedValue(
      new Response(JSON.stringify({
        id: "promo-1",
        name: "Promo actualizada",
        description: "Descuento de temporada",
        scope: "product",
        product_id: "P001",
        type: "percentage",
        discount_percent: 10,
        start_date: "2026-07-01T00:00:00.000Z",
        end_date: "2026-07-31T00:00:00.000Z",
        weekdays: null,
        enabled: false,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      }), { status: 200 })
    )

    const repository = new ApiPromotionRepository()
    const patch: Partial<Promotion> = { name: "Promo actualizada", enabled: false }

    const updated = await repository.updatePromotion("promo-1", patch)

    expect(updated.name).toBe("Promo actualizada")
    expect(updated.enabled).toBe(false)

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions/promo-1")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toEqual({
      name: "Promo actualizada",
      enabled: false,
    })
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
