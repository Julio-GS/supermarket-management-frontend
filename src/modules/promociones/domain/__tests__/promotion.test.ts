import { describe, expect, it } from "vitest"

import {
  buildPromotionUpdatePayload,
  hasActivePromotionConflict,
  type Promotion,
} from "../promotion"

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-1",
    name: "Promo 1",
    description: null,
    scope: "product",
    productId: "P001",
    type: "percentage",
    discountPercent: 10,
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-31T00:00:00.000Z",
    weekdays: null,
    enabled: true,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("Promotion domain helpers", () => {
  it("blocks a second active product-scoped promotion for the same product", () => {
    const promotions = [
      makePromotion(),
      makePromotion({ id: "promo-2", name: "Promo 2" }),
    ]

    expect(
      hasActivePromotionConflict(promotions, {
        enabled: true,
        scope: "product",
        productId: "P001",
      })
    ).toBe(true)
  })

  it("does not block a store-scoped promotion", () => {
    const promotions = [
      makePromotion(),
    ]

    expect(
      hasActivePromotionConflict(promotions, {
        enabled: true,
        scope: "store",
        productId: null,
      })
    ).toBe(false)
  })

  it("does not block a disabled promotion", () => {
    const promotions: Promotion[] = []

    expect(
      hasActivePromotionConflict(promotions, {
        enabled: false,
        scope: "product",
        productId: "P001",
      })
    ).toBe(false)
  })

  it("builds a partial update payload with only changed fields", () => {
    const previous = makePromotion()

    const payload = buildPromotionUpdatePayload(previous, {
      ...previous,
      description: "Nuevo texto",
      enabled: false,
      weekdays: [1, 3],
      startDate: null,
      endDate: null,
    })

    expect(payload).toEqual({
      description: "Nuevo texto",
      enabled: false,
      weekdays: [1, 3],
      startDate: null,
      endDate: null,
    })
  })
})
