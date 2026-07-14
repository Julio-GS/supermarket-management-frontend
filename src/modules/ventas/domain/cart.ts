import type { ProductPromotionSummary } from "@/modules/productos/domain/product"

export interface CartProduct {
  id: string
  name: string
  price: number
  unit: string
  promotions: ProductPromotionSummary[] | null
  storePromotions: ProductPromotionSummary[] | null
}

export interface CartItem {
  product: CartProduct
  quantity: number
  /** Row-level identity for special (protected) items so repeated codes stay separate. */
  lineId?: string
  /** Manual line total as a canonical decimal string (special protected products only). */
  manualLineTotal?: string
}

export interface Cart {
  items: CartItem[]
}

export const emptyCart: Cart = { items: [] }

export interface AddItemOptions {
  /** Row-level identity — when provided, items are NOT merged by product id. */
  lineId?: string
  /** Manual line total for special protected products. */
  manualLineTotal?: string
}

export function addItem(cart: Cart, product: CartProduct, quantity = 1, options?: AddItemOptions): Cart {
  // Special products with lineId: always add as a new entry (never merge by product id)
  if (options?.lineId) {
    return {
      items: [
        ...cart.items,
        { product, quantity, lineId: options.lineId, manualLineTotal: options.manualLineTotal },
      ],
    }
  }

  // Normal products: merge by product id
  const existing = cart.items.find((item) => item.product.id === product.id)
  if (existing) {
    return {
      items: cart.items.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ),
    }
  }
  return { items: [...cart.items, { product, quantity }] }
}

export function changeQuantity(cart: Cart, productId: string, delta: number): Cart {
  return {
    items: cart.items.flatMap((item) => {
      if (item.product.id === productId) {
        const nextQty = Math.max(0, item.quantity + delta)
        return nextQty > 0 ? [{ ...item, quantity: nextQty }] : []
      }
      return [item]
    }),
  }
}

export function removeItem(cart: Cart, productId: string): Cart {
  return { items: cart.items.filter((item) => item.product.id !== productId) }
}
