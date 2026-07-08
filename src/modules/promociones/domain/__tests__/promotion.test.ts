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
    description: "",
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

describe("Promotion domain helpers", () => {
  it("blocks a second active promotion for the same product", () => {
    const promotions = [
      makePromotion(),
      makePromotion({ id: "promo-2", productIds: ["P001"], name: "Promo 2" }),
    ]

    expect(
      hasActivePromotionConflict(promotions, {
        active: true,
        productIds: ["P001"],
      })
    ).toBe(true)
  })

  it("builds a partial update payload with only changed fields", () => {
    const previous = makePromotion()

    const payload = buildPromotionUpdatePayload(previous, {
      ...previous,
      description: "Nuevo texto",
      active: false,
      weekdays: [1, 3],
      startDate: null,
      endDate: null,
    })

    expect(payload).toEqual({
      description: "Nuevo texto",
      active: false,
      weekdays: [1, 3],
      startDate: null,
      endDate: null,
    })
  })
})
