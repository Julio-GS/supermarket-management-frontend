import type { CartItem, CartProduct } from "./cart"

// ---- Types ----

export type ManualDiscountCode = "cash-10" | "card-5"

const MANUAL_DISCOUNT_LABELS: Record<ManualDiscountCode, string> = {
  "cash-10": "10% Efectivo",
  "card-5": "5% Tarjeta",
}

const MANUAL_DISCOUNT_RATES: Record<ManualDiscountCode, number> = {
  "cash-10": 0.1,
  "card-5": 0.05,
}

export interface DiscountLine {
  kind: "promotion" | "manual"
  label: string
  amountCents: number
}

export interface CheckoutPricing {
  subtotalCents: number
  promotionDiscountCents: number
  promotionAdjustedTotalCents: number
  manualDiscount: ManualDiscountCode | null
  manualDiscountCents: number
  payableTotalCents: number
  discountLines: DiscountLine[]
}

export interface CalculateCheckoutPricingInput {
  items: CartItem[]
  activeStorePromotions?: CartProduct["storePromotions"]
  manualDiscount: ManualDiscountCode | null
}

// ---- Public API ----

/**
 * Compute the complete checkout pricing in integer cents.
 *
 * Order of application:
 * 1. Cart subtotal (all items, including manualLineTotal for special products)
 * 2. Promotion discounts (best product promo + all store promos stack)
 * 3. Manual discount applied on top of promotion-adjusted total
 *
 * This is a pure function: it never mutates items, products, prices, or promotions.
 * All values are integer cents to avoid floating-point drift.
 */
export function calculateCheckoutPricing(
  input: CalculateCheckoutPricingInput
): CheckoutPricing {
  const { items, activeStorePromotions, manualDiscount } = input

  // 1. Subtotal in cents
  const subtotalCents = computeSubtotalCents(items)

  // 2. Promotion discounts
  const {
    totalDiscountCents: promotionDiscountCents,
    discountLines: promoLines,
  } = computePromotionDiscounts(items, activeStorePromotions)

  const promotionAdjustedTotalCents = Math.max(
    0,
    subtotalCents - promotionDiscountCents
  )

  // 3. Manual discount
  const manualDiscountCents = manualDiscount
    ? Math.floor(promotionAdjustedTotalCents * MANUAL_DISCOUNT_RATES[manualDiscount])
    : 0

  const payableTotalCents = Math.max(
    0,
    promotionAdjustedTotalCents - manualDiscountCents
  )

  // 4. Build discount lines
  const discountLines: DiscountLine[] = [...promoLines]
  if (manualDiscount && manualDiscountCents > 0) {
    discountLines.push({
      kind: "manual",
      label: MANUAL_DISCOUNT_LABELS[manualDiscount],
      amountCents: manualDiscountCents,
    })
  }

  return {
    subtotalCents,
    promotionDiscountCents,
    promotionAdjustedTotalCents,
    manualDiscount: manualDiscount ?? null,
    manualDiscountCents,
    payableTotalCents,
    discountLines,
  }
}

// ---- Internal helpers ----

function computeSubtotalCents(items: CartItem[]): number {
  let total = 0
  for (const item of items) {
    if (item.kind === "ad-hoc") {
      total += Math.round(item.unitPrice * item.quantity * 100)
    } else if (item.manualLineTotal) {
      const parsed = Number.parseFloat(item.manualLineTotal)
      if (Number.isFinite(parsed) && parsed > 0) {
        total += Math.round(parsed * 100)
      }
    } else {
      total += Math.round(item.product.price * item.quantity * 100)
    }
  }
  return total
}

function computePromotionDiscounts(
  items: CartItem[],
  activeStorePromotions?: CartProduct["storePromotions"]
): { totalDiscountCents: number; discountLines: DiscountLine[] } {
  const lines: DiscountLine[] = []
  let total = 0

  for (const item of items) {
    // Ad-hoc items receive only store promotions
    if (item.kind === "ad-hoc") {
      const itemSubtotalCents = Math.round(item.unitPrice * item.quantity * 100)
      if (activeStorePromotions?.length) {
        for (const p of activeStorePromotions) {
          const d = computePromoDiscountCents(itemSubtotalCents, item.unitPrice, item.quantity, p)
          if (d > 0) {
            lines.push({
              kind: "promotion",
              label: `${item.name} — ${p.name}`,
              amountCents: d,
            })
            total += d
          }
        }
      }
      continue
    }

    // Catalog items
    const { product, quantity } = item

    // Compute item subtotal in cents
    const itemSubtotalCents = item.manualLineTotal
      ? Math.round(Number.parseFloat(item.manualLineTotal) * 100)
      : Math.round(product.price * quantity * 100)

    if (itemSubtotalCents <= 0) continue

    // Best product promotion (only highest discount applies)
    if (product.promotions?.length) {
      let bestAmount = 0
      let bestLabel = ""
      for (const p of product.promotions) {
        const d = computePromoDiscountCents(itemSubtotalCents, product.price, quantity, p)
        if (d > bestAmount) {
          bestAmount = d
          bestLabel =
            p.type === "two_x_one"
              ? `${product.name} — 2x1`
              : `${product.name} — ${p.discountPercent}% OFF`
        }
      }
      if (bestAmount > 0) {
        lines.push({ kind: "promotion", label: bestLabel, amountCents: bestAmount })
        total += bestAmount
      }
    }

    // All store promotions stack
    if (product.storePromotions?.length) {
      for (const p of product.storePromotions) {
        const d = computePromoDiscountCents(itemSubtotalCents, product.price, quantity, p)
        if (d > 0) {
          lines.push({
            kind: "promotion",
            label: `${product.name} — ${p.name}`,
            amountCents: d,
          })
          total += d
        }
      }
    }
  }

  return { totalDiscountCents: total, discountLines: lines }
}

function computePromoDiscountCents(
  itemSubtotalCents: number,
  unitPrice: number,
  quantity: number,
  promotion: {
    type: "percentage" | "two_x_one"
    discountPercent?: number | null
  }
): number {
  if (promotion.type === "percentage" && promotion.discountPercent) {
    return Math.round((itemSubtotalCents * promotion.discountPercent) / 100)
  }
  if (promotion.type === "two_x_one") {
    const freeUnits = Math.floor(quantity / 2)
    return Math.round(unitPrice * freeUnits * 100)
  }
  return 0
}
