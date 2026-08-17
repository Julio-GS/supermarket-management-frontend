import { describe, expect, it } from "vitest"
import { buildDisplayDiscounts } from "../checkout-pricing-display"
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

const percentagePromo = (
  id: string,
  name: string,
  discountPercent: number
): CartProduct["promotions"] => [
  {
    id,
    name,
    description: null,
    scope: "product" as const,
    type: "percentage" as const,
    discountPercent,
    startDate: null,
    endDate: null,
    weekdays: null,
  },
]

const twoXOnePromo = (id: string, name: string): CartProduct["promotions"] => [
  {
    id,
    name,
    description: null,
    scope: "product" as const,
    type: "two_x_one" as const,
    discountPercent: null,
    startDate: null,
    endDate: null,
    weekdays: null,
  },
]

const storePercentagePromo = (
  id: string,
  name: string,
  discountPercent: number
): CartProduct["storePromotions"] => [
  {
    id,
    name,
    description: null,
    scope: "store" as const,
    type: "percentage" as const,
    discountPercent,
    startDate: null,
    endDate: null,
    weekdays: null,
  },
]

// ---- Tests ----

describe("buildDisplayDiscounts", () => {
  // ── Product promotion: single percentage-off ─────────────────

  it("produces one labeled line for a single product percentage promotion", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 2, {
        promotions: percentagePromo("promo-1", "10% OFF", 10),
      }),
    ]

    const result = buildDisplayDiscounts(items)

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].label).toBe("Manzana — 10% OFF")
    // 10% of subtotal (200) = 20.00
    expect(result.lines[0].amount).toBe(20)
    expect(result.totalDiscount).toBe(20)
  })

  // ── Store promotion stacking ────────────────────────────────

  it("produces a separate labeled line for store promotions (stacking)", () => {
    const storePromos = storePercentagePromo("store-1", "5% Tienda", 5)

    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 2, {
        promotions: percentagePromo("promo-1", "10% OFF", 10),
        storePromotions: storePromos,
      }),
    ]

    const result = buildDisplayDiscounts(items, storePromos)

    // Product promo + store promo = 2 lines
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0].label).toBe("Manzana — 10% OFF")
    expect(result.lines[1].label).toBe("Manzana — 5% Tienda")
    // 10% of 200 = 20 + 5% of 200 = 10 => total 30
    expect(result.totalDiscount).toBe(30)
  })

  // ── Two-for-one ─────────────────────────────────────────────

  it("produces a '2x1' labeled line with correct free-unit count", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Leche", 100, 4, {
        promotions: twoXOnePromo("promo-1", "2x1 Leche"),
      }),
    ]

    const result = buildDisplayDiscounts(items)

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].label).toBe("Leche — 2x1")
    // 4 units → 2 free → 2 × 100 = 200
    expect(result.lines[0].amount).toBe(200)
    expect(result.totalDiscount).toBe(200)
  })

  // ── Ad-hoc items produce NO automatic promotion lines ───────

  it("produces NO automatic promotion lines for ad-hoc items", () => {
    const storePromos = storePercentagePromo("store-1", "10% Tienda", 10)

    const items: CartItem[] = [
      adHocItem("d1", "Servicio Especial", 100, 2),
    ]

    const result = buildDisplayDiscounts(items, storePromos)

    expect(result.lines).toHaveLength(0)
    expect(result.totalDiscount).toBe(0)
  })

  // ── Manual line total as discount base ──────────────────────

  it("uses manualLineTotal as the discount base for special items", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Especial", 0, 1, {
        manualLineTotal: "50.00",
        promotions: percentagePromo("promo-1", "20% OFF", 20),
      }),
    ]

    const result = buildDisplayDiscounts(items)

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].label).toBe("Especial — 20% OFF")
    // 20% of 50 = 10
    expect(result.lines[0].amount).toBe(10)
    expect(result.totalDiscount).toBe(10)
  })

  // ── Label format byte-for-byte ──────────────────────────────

  it("produces exact label formats: `${name} — 2x1`", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Cerveza", 150, 3, {
        promotions: twoXOnePromo("promo-1", "2x1 Cerveza"),
      }),
    ]

    const result = buildDisplayDiscounts(items)
    expect(result.lines[0].label).toBe("Cerveza — 2x1")
  })

  it("produces exact label formats: `${name} — ${p.discountPercent}% OFF`", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Queso", 200, 1, {
        promotions: percentagePromo("promo-1", "15% OFF", 15),
      }),
    ]

    const result = buildDisplayDiscounts(items)
    expect(result.lines[0].label).toBe("Queso — 15% OFF")
  })

  it("produces exact label formats: `${name} — ${p.name}`", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Pan", 100, 2, {
        storePromotions: storePercentagePromo("store-1", "Liquidación", 10),
      }),
    ]

    const result = buildDisplayDiscounts(items)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].label).toBe("Pan — Liquidación")
  })

  // ── Empty cart ──────────────────────────────────────────────

  it("returns empty lines and zero total for empty cart", () => {
    const result = buildDisplayDiscounts([])
    expect(result.lines).toEqual([])
    expect(result.totalDiscount).toBe(0)
  })

  // ── Best product promo only (not stack) ─────────────────────

  it("selects only the best (highest) product promotion, not stack", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Manzana", 100, 1, {
        promotions: [
          {
            id: "promo-1",
            name: "10% OFF",
            description: null,
            scope: "product" as const,
            type: "percentage" as const,
            discountPercent: 10,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
          {
            id: "promo-2",
            name: "5% OFF",
            description: null,
            scope: "product" as const,
            type: "percentage" as const,
            discountPercent: 5,
            startDate: null,
            endDate: null,
            weekdays: null,
          },
        ],
      }),
    ]

    const result = buildDisplayDiscounts(items)

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].label).toBe("Manzana — 10% OFF")
    // 10% of 100 = 10 (not 15)
    expect(result.lines[0].amount).toBe(10)
  })

  // ── TRIANGULATION: field stability with all fixture types ───

  it("returns stable fields for a complex fixture with all promo types + manualLineTotal + ad-hoc", () => {
    const storePromos = [
      {
        id: "store-1",
        name: "5% Tienda",
        description: null,
        scope: "store" as const,
        type: "percentage" as const,
        discountPercent: 5,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ]

    const items: CartItem[] = [
      // 1. Catalog with product percentage promo
      catalogItem("P001", "Manzana", 100, 2, {
        promotions: percentagePromo("promo-1", "10% OFF", 10),
        storePromotions: storePromos,
      }),
      // 2. Catalog with 2x1 promo
      catalogItem("P002", "Leche", 80, 4, {
        promotions: twoXOnePromo("promo-2", "2x1 Leche"),
      }),
      // 3. Manual line total item (no promo)
      catalogItem("P003", "Especial", 0, 1, {
        manualLineTotal: "25.00",
      }),
      // 4. Ad-hoc item (excluded from promos)
      adHocItem("d1", "Servicio", 50, 1),
    ]

    const result = buildDisplayDiscounts(items, storePromos)

    // Expected lines:
    // "Manzana — 10% OFF" = 10% of 200 = 20
    // "Manzana — 5% Tienda" = 5% of 200 = 10
    // "Leche — 2x1" = 2 free × 80 = 160
    // Ad-hoc: excluded
    // Manual: no promo
    expect(result.lines).toHaveLength(3)
    expect(result.lines[0]).toEqual({ label: "Manzana — 10% OFF", amount: 20 })
    expect(result.lines[1]).toEqual({ label: "Manzana — 5% Tienda", amount: 10 })
    expect(result.lines[2]).toEqual({ label: "Leche — 2x1", amount: 160 })
    expect(result.totalDiscount).toBe(190)

    // Stability: run again, same result
    const result2 = buildDisplayDiscounts(items, storePromos)
    expect(result2).toEqual(result)
  })

  // ── Domain parity: display amounts within 0.01 of domain cents/100 ──

  it("display amounts agree with domain pricing within 0.01 for all fixture classes", () => {
    const storePromos: CartProduct["storePromotions"] = [
      {
        id: "store-1",
        name: "5% Tienda",
        description: null,
        scope: "store" as const,
        type: "percentage" as const,
        discountPercent: 5,
        startDate: null,
        endDate: null,
        weekdays: null,
      },
    ]

    const items: CartItem[] = [
      // Product promo
      catalogItem("P001", "Manzana", 100, 2, {
        promotions: percentagePromo("promo-1", "10% OFF", 10),
        storePromotions: storePromos,
      }),
      // 2x1 promo
      catalogItem("P002", "Leche", 80, 4, {
        promotions: twoXOnePromo("promo-2", "2x1 Leche"),
      }),
      // Manual line total
      catalogItem("P003", "Especial", 0, 1, {
        manualLineTotal: "25.00",
      }),
      // Ad-hoc
      adHocItem("d1", "Servicio", 50, 1),
    ]

    const display = buildDisplayDiscounts(items, storePromos)
    const domain = calculateCheckoutPricing({ items, manualDiscount: null })

    // Domain promotion discount in dollars
    const domainPromoDiscount = domain.promotionDiscountCents / 100

    // Display total must be within 0.01 of domain
    expect(Math.abs(display.totalDiscount - domainPromoDiscount)).toBeLessThanOrEqual(0.01)

    // Domain subtotal for reference: Manzana 20000 + Leche 32000 + Especial 2500 + Servicio 5000
    expect(domain.subtotalCents).toBe(59500)
  })

  // ── 2x1 with manualLineTotal ───────────────────────────────

  it("uses manualLineTotal as the base for 2x1 free units", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Especial", 0, 4, {
        manualLineTotal: "200.00",
        promotions: twoXOnePromo("promo-1", "2x1 Especial"),
      }),
    ]

    const result = buildDisplayDiscounts(items)

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].label).toBe("Especial — 2x1")
    // manualLineTotal is the subtotal base: $200 for 4 items → unitPrice = 200 / 4 = 50? No...
    // The panel uses manualLineTotal as parsed float for unit price when manualLineTotal exists.
    // Actually, looking at computeCartDiscounts: for 2x1, it uses `unitPrice = item.manualLineTotal ? parseFloat(item.manualLineTotal) : product.price`
    // and `free = Math.floor(quantity / 2)`, `d = unitPrice * free`.
    // So: unitPrice = 200, free = 2, d = 400
    expect(result.lines[0].amount).toBe(400)
  })

  // ── Multiple catalog items with mixed promos ────────────────

  it("handles multiple catalog items each with different promo types", () => {
    const items: CartItem[] = [
      catalogItem("P001", "Queso", 200, 1, {
        promotions: percentagePromo("promo-1", "15% OFF", 15),
      }),
      catalogItem("P002", "Pan", 50, 6, {
        promotions: twoXOnePromo("promo-2", "2x1 Pan"),
      }),
    ]

    const result = buildDisplayDiscounts(items)

    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toEqual({ label: "Queso — 15% OFF", amount: 30 }) // 15% of 200
    expect(result.lines[1]).toEqual({ label: "Pan — 2x1", amount: 150 }) // 3 free × 50
    expect(result.totalDiscount).toBe(180)
  })
})
