import type { CartItem, CartProduct } from "./cart"

export interface DisplayDiscountLine {
  label: string
  amount: number
}

export interface DisplayDiscounts {
  lines: DisplayDiscountLine[]
  totalDiscount: number
}

/**
 * Compute display discount lines for the POS payment panel.
 *
 * For each catalog item:
 *   - Product promotions: only the best (highest discount) applies
 *   - Store promotions: all of them stack
 *
 * Ad-hoc items are excluded from all automatic promotions.
 * manualLineTotal is used as the subtotal base for special products.
 *
 * Returns float amounts (dollars) matching the panel's existing rendering format.
 */
export function buildDisplayDiscounts(
  items: CartItem[],
  activeStorePromotions?: CartProduct["storePromotions"]
): DisplayDiscounts {
  const lines: DisplayDiscountLine[] = []
  let totalDiscount = 0

  for (const item of items) {
    // Ad-hoc/occasional items are excluded from ALL automatic promotions.
    if (item.kind === "ad-hoc") {
      continue
    }

    if (item.kind !== "catalog") continue

    const { product, quantity } = item

    // Use manualLineTotal as the subtotal base for special products.
    const itemSubtotal = item.manualLineTotal
      ? Number.parseFloat(item.manualLineTotal)
      : product.price * quantity

    if (!Number.isFinite(itemSubtotal) || itemSubtotal <= 0) continue

    // Best product promotion (only the highest discount applies)
    if (product.promotions?.length) {
      let bestAmount = 0
      let bestLabel = ""
      for (const p of product.promotions) {
        let d = 0
        if (p.type === "percentage" && p.discountPercent) {
          d = (itemSubtotal * p.discountPercent) / 100
        } else if (p.type === "two_x_one") {
          const unitPrice = item.manualLineTotal
            ? Number.parseFloat(item.manualLineTotal)
            : product.price
          const free = Math.floor(quantity / 2)
          d = unitPrice * free
        }
        if (d > bestAmount) {
          bestAmount = d
          bestLabel =
            p.type === "two_x_one"
              ? `${product.name} — 2x1`
              : `${product.name} — ${p.discountPercent}% OFF`
        }
      }
      if (bestAmount > 0) {
        lines.push({ label: bestLabel, amount: bestAmount })
        totalDiscount += bestAmount
      }
    }

    // All store promotions stack
    if (product.storePromotions?.length) {
      for (const p of product.storePromotions) {
        let d = 0
        if (p.type === "percentage" && p.discountPercent) {
          d = (itemSubtotal * p.discountPercent) / 100
        } else if (p.type === "two_x_one") {
          const unitPrice = item.manualLineTotal
            ? Number.parseFloat(item.manualLineTotal)
            : product.price
          const free = Math.floor(quantity / 2)
          d = unitPrice * free
        }
        if (d > 0) {
          lines.push({ label: `${product.name} — ${p.name}`, amount: d })
          totalDiscount += d
        }
      }
    }
  }

  return { lines, totalDiscount }
}
