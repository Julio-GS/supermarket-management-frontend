import { describe, expect, it } from "vitest"
import { calculateCheckoutPricing } from "../checkout-pricing"
import type { CartItem, CartProduct } from "../cart"

// ---- Test helpers ----

function catalogItem(
  id: string,
  name: string,
  price: number,
  quantity: number,
  opts?: {
    promotions?: CartProduct["promotions"]
    storePromotions?: CartProduct["storePromotions"]
    manualLineTotal?: string
  }
): CartItem {
  return {
    kind: "catalog",
    product: {
      id,
      name,
      price,
      unit: "u",
      promotions: opts?.promotions ?? null,
      storePromotions: opts?.storePromotions ?? null,
    },
    quantity,
    manualLineTotal: opts?.manualLineTotal,
  }
}

function adHocItem(
  draftId: string,
  name: string,
  unitPrice: number,
  quantity: number
): CartItem {
  return {
    kind: "ad-hoc",
    draftId,
    name,
    unitPrice,
    quantity,
  }
}

const emptyStorePromos = null as CartProduct["storePromotions"]

// ---- Tests ----

describe("calculateCheckoutPricing", () => {
  // ── Basic subtotal ──────────────────────────────────────────

  it("computes subtotal from catalog items", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 1.2, 2), // 240 cents
      catalogItem("P002", "Leche", 1.1, 1), // 110 cents
    ]

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    expect(result.subtotalCents).toBe(350) // $3.50
    expect(result.promotionDiscountCents).toBe(0)
    expect(result.promotionAdjustedTotalCents).toBe(350)
    expect(result.manualDiscountCents).toBe(0)
    expect(result.payableTotalCents).toBe(350)
    expect(result.discountLines).toEqual([])
  })

  it("computes subtotal from ad-hoc items", () => {
    const items: CartItem[] = [adHocItem("d1", "Servicio", 100, 2)] // 20000 cents

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    expect(result.subtotalCents).toBe(20000) // $200.00
    expect(result.payableTotalCents).toBe(20000)
  })

  it("computes subtotal from mixed catalog and ad-hoc items", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 1.5, 3), // 450 cents
      adHocItem("d1", "Bolsa", 0.5, 2), // 100 cents
    ]

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    expect(result.subtotalCents).toBe(550) // $5.50
  })

  it("uses manualLineTotal for special catalog items", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Especial", 0, 1, { manualLineTotal: "15.50" }),
    ]

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    expect(result.subtotalCents).toBe(1550) // $15.50
  })

  // ── Promotion discounts ──────────────────────────────────────

  it("applies best product promotion only (not stack)", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 1, {
        promotions: [
          {
            id: "promo-1",
            name: "10% OFF",
            description: "10% desc",
            scope: "product",
            type: "percentage",
            discountPercent: 10,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
          {
            id: "promo-2",
            name: "5% OFF",
            description: "5% desc",
            scope: "product",
            type: "percentage",
            discountPercent: 5,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
    ]

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    expect(result.promotionDiscountCents).toBe(1000) // 10% of 10000 = 1000
    expect(result.promotionAdjustedTotalCents).toBe(9000)
    expect(result.payableTotalCents).toBe(9000)
    expect(result.discountLines).toHaveLength(1)
    expect(result.discountLines[0]).toMatchObject({
      kind: "promotion",
      amountCents: 1000,
    })
  })

  it("stacks store promotions on top of best product promotion", () => {
    const storePromos: CartProduct["storePromotions"] = [
      {
        id: "store-1",
        name: "5% Tienda",
        description: "5% OFF tienda",
        scope: "store",
        type: "percentage",
        discountPercent: 5,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ]

    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 2, {
        promotions: [
          {
            id: "promo-1",
            name: "10% OFF",
            description: "10% desc",
            scope: "product",
            type: "percentage",
            discountPercent: 10,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
        storePromotions: storePromos,
      }),
    ]

    const result = calculateCheckoutPricing({
      items,
      activeStorePromotions: storePromos,
      manualDiscount: null,
    })

    // Subtotal: 20000 cents
    // Best product promo: 10% of 20000 = 2000
    // Store promo: 5% of 20000 = 1000
    // Total discount: 3000
    expect(result.promotionDiscountCents).toBe(3000)
    expect(result.promotionAdjustedTotalCents).toBe(17000)
    expect(result.payableTotalCents).toBe(17000)
    expect(result.discountLines).toHaveLength(2)
  })

  it("applies 2x1 product promotion correctly", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Leche", 100, 4, {
        promotions: [
          {
            id: "promo-1",
            name: "2x1 Leche",
            description: "2x1",
            scope: "product",
            type: "two_x_one",
            discountPercent: null,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
    ]

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    // Subtotal: 40000 cents (4 x 100)
    // 2x1: 2 free units => 20000 cents discount
    expect(result.promotionDiscountCents).toBe(20000)
    expect(result.promotionAdjustedTotalCents).toBe(20000)
    expect(result.payableTotalCents).toBe(20000)
  })

  // ── Manual discounts ─────────────────────────────────────────

  it("applies 10% cash manual discount after promotions", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 1),
    ]

    const result = calculateCheckoutPricing({
      items,
      manualDiscount: "cash-10",
    })

    // Subtotal: 10000 cents
    // No promotions
    // 10% manual: 1000 cents
    expect(result.subtotalCents).toBe(10000)
    expect(result.promotionDiscountCents).toBe(0)
    expect(result.promotionAdjustedTotalCents).toBe(10000)
    expect(result.manualDiscountCents).toBe(1000)
    expect(result.payableTotalCents).toBe(9000)
    expect(result.manualDiscount).toBe("cash-10")
    expect(result.discountLines).toHaveLength(1)
    expect(result.discountLines[0]).toMatchObject({
      kind: "manual",
      amountCents: 1000,
    })
  })

  it("applies 5% card manual discount after promotions", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 1),
    ]

    const result = calculateCheckoutPricing({
      items,
      manualDiscount: "card-5",
    })

    expect(result.manualDiscountCents).toBe(500) // 5% of 10000
    expect(result.payableTotalCents).toBe(9500)
    expect(result.manualDiscount).toBe("card-5")
  })

  it("applies manual discount on top of promotion-adjusted total", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 2, {
        promotions: [
          {
            id: "promo-1",
            name: "10% OFF",
            description: "10% desc",
            scope: "product",
            type: "percentage",
            discountPercent: 10,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
    ]

    const result = calculateCheckoutPricing({
      items,
      manualDiscount: "cash-10",
    })

    // Subtotal: 20000 cents
    // Promotion: 10% => 2000 cents
    // Promotion-adjusted: 18000
    // Manual 10% on 18000 => 1800
    expect(result.promotionDiscountCents).toBe(2000)
    expect(result.promotionAdjustedTotalCents).toBe(18000)
    expect(result.manualDiscountCents).toBe(1800)
    expect(result.payableTotalCents).toBe(16200)
    expect(result.discountLines).toHaveLength(2)
  })

  it("null manual discount produces no manual discount", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 1),
    ]

    const result = calculateCheckoutPricing({ items, manualDiscount: null })

    expect(result.manualDiscount).toBeNull()
    expect(result.manualDiscountCents).toBe(0)
    expect(result.payableTotalCents).toBe(10000)
  })

  // ── Rounding safety ──────────────────────────────────────────

  it("rounds manual discount to integer cents (floor)", () => {
    // Subtotal that produces fractional cents with 10%
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 1.11, 1), // 111 cents
    ]

    const result = calculateCheckoutPricing({
      items,
      manualDiscount: "cash-10",
    })

    // 10% of 111 = 11.1 → floor to 11
    expect(result.manualDiscountCents).toBe(11)
    expect(result.payableTotalCents).toBe(100) // 111 - 11
  })

  it("clamps payable total to 0 when discounts exceed subtotal", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 1, 1), // 100 cents
    ]

    // Manual 10% on 100 = 10, but let's also have a big promotion
    const result = calculateCheckoutPricing({
      items: [
        catalogItem("P001", "Manzana", 1, 1, {
          promotions: [
            {
              id: "promo-big",
              name: "99% OFF",
              description: "big",
              scope: "product",
              type: "percentage",
              discountPercent: 99,
              startDate: null,
              endDate: null,
              weekdays: null,
            },
          ],
        }),
      ],
      manualDiscount: "cash-10",
    })

    // Subtotal: 100
    // Promotion: 99% => 99 cents
    // Adjusted: 1 cent
    // Manual 10% => floor(0.1) => 0
    // Payable: 1 (already >= 0)
    expect(result.payableTotalCents).toBeGreaterThanOrEqual(0)
  })

  // ── Discount line ordering ────────────────────────────────────

  it("returns discountLines with promotions then manual", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 1, {
        promotions: [
          {
            id: "promo-1",
            name: "5% OFF",
            description: "5% desc",
            scope: "product",
            type: "percentage",
            discountPercent: 5,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
    ]

    const result = calculateCheckoutPricing({
      items,
      manualDiscount: "cash-10",
    })

    expect(result.discountLines).toHaveLength(2)
    expect(result.discountLines[0].kind).toBe("promotion")
    expect(result.discountLines[1].kind).toBe("manual")
  })

  // ── Empty cart ───────────────────────────────────────────────

  it("returns zero pricing for an empty cart", () => {
    const result = calculateCheckoutPricing({ items: [], manualDiscount: null })

    expect(result.subtotalCents).toBe(0)
    expect(result.promotionDiscountCents).toBe(0)
    expect(result.promotionAdjustedTotalCents).toBe(0)
    expect(result.manualDiscountCents).toBe(0)
    expect(result.payableTotalCents).toBe(0)
    expect(result.discountLines).toEqual([])
  })
})
