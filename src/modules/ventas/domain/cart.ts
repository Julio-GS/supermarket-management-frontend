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
}

export interface Cart {
  items: CartItem[]
}

export const emptyCart: Cart = { items: [] }

export function addItem(cart: Cart, product: CartProduct, quantity = 1): Cart {
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
