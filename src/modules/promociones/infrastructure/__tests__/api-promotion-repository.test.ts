import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiPromotionRepository, toBackend, toBackendPatch, toDomain } from "../api-promotion-repository"
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
        weekdays: [7, 1, 6],
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
    expect(promotions[0].weekdays).toEqual([0, 1, 6])

    const [url] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions")
  })

  it("normalizes weekdays between backend and frontend shapes", () => {
    const domain = toDomain({
      id: "promo-1",
      name: "Promo verano",
      description: null,
      scope: "product",
      product_id: "P001",
      type: "percentage",
      discount_percent: 10,
      start_date: null,
      end_date: null,
      weekdays: [7, 1, 6],
      enabled: true,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    })

    expect(domain.weekdays).toEqual([0, 1, 6])

    expect(
      toDomain({
        id: "promo-null",
        name: "Promo nula",
        description: null,
        scope: "store",
        product_id: null,
        type: "two_x_one",
        discount_percent: null,
        start_date: null,
        end_date: null,
        weekdays: null,
        enabled: true,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      }).weekdays
    ).toBeNull()

    const backendPayload = toBackend({
      name: "Promo nueva",
      description: "Nuevo descuento",
      scope: "product",
      type: "percentage",
      discountPercent: 15,
      startDate: null,
      endDate: null,
      weekdays: [0, 1, 6],
      enabled: true,
      productId: "P002",
    })

    expect(backendPayload.weekdays).toEqual([7, 1, 6])
    expect(toBackend({
      name: "Promo nula",
      description: null,
      scope: "store",
      type: "two_x_one",
      discountPercent: null,
      startDate: null,
      endDate: null,
      weekdays: null,
      enabled: true,
      productId: null,
    }).weekdays).toBeNull()
    expect(toBackendPatch({ weekdays: [0, 1, 6] }).weekdays).toEqual([7, 1, 6])
    expect(toBackendPatch({ weekdays: null })).toEqual({ weekdays: null })
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
        weekdays: [7, 1, 6],
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
      weekdays: [0, 1, 6],
      enabled: true,
      productId: "P002",
    }

    const created = await repository.createPromotion(payload)

    expect(created.id).toBe("promo-2")
    expect(created.weekdays).toEqual([0, 1, 6])

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
      weekdays: [7, 1, 6],
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
        weekdays: [7, 1, 6],
        enabled: false,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      }), { status: 200 })
    )

    const repository = new ApiPromotionRepository()
    const patch: Partial<Promotion> = { name: "Promo actualizada", enabled: false, weekdays: [0, 1, 6] }

    const updated = await repository.updatePromotion("promo-1", patch)

    expect(updated.name).toBe("Promo actualizada")
    expect(updated.enabled).toBe(false)
    expect(updated.weekdays).toEqual([0, 1, 6])

    const [url, options] = getFetchMock().mock.calls[0]
    expect(url).toBe("https://api.example.com/api/v1/promotions/promo-1")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toEqual({
      name: "Promo actualizada",
      enabled: false,
      weekdays: [7, 1, 6],
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
