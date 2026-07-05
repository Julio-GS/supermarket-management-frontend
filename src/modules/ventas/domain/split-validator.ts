import type { SplitTicketGroupDraft } from "../application/checkout-port"
import type { CartItem } from "./cart"

/**
 * Validate split-ticket groups against cart items.
 * Returns an error string or null if valid.
 */
export function validateSplitGroups(
  cartItems: CartItem[],
  groups: SplitTicketGroupDraft[]
): string | null {
  if (groups.length !== 2) return "Se requieren exactamente 2 grupos."
  if (groups[0].label === groups[1].label) return "Los labels de los grupos deben ser distintos."

  // Check quantity balance per product
  const totalQty = new Map(cartItems.map((ci) => [ci.product.id, ci.quantity]))

  const splitQty = new Map<string, number>()
  for (const group of groups) {
    for (const item of group.items) {
      splitQty.set(item.productId, (splitQty.get(item.productId) ?? 0) + item.quantity)
    }
  }

  for (const [productId, expected] of totalQty) {
    const assigned = splitQty.get(productId) ?? 0
    if (assigned !== expected) {
      return `La distribución de cantidades no cierra para el producto.`
    }
  }

  // Ensure all split items reference existing cart products
  for (const group of groups) {
    for (const item of group.items) {
      if (!totalQty.has(item.productId)) {
        return `Producto "${item.productId}" no está en el carrito.`
      }
    }
  }

  return null
}
