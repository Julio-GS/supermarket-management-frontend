export type CartPromotionScope = "product" | "store"

export interface CartProductPromotion {
  id: string
  name: string
  description: string | null
  scope: CartPromotionScope
  type: "percentage" | "two_x_one"
  discountPercent: number | null
  startDate: string | null
  endDate: string | null
  weekdays: number[] | null
}

export interface CartProduct {
  id: string
  name: string
  price: number
  unit: string
  promotions: CartProductPromotion[] | null
  storePromotions: CartProductPromotion[] | null
  /** VAT rate (e.g. 10.5 or 21). Preserved from catalog product. */
  iva?: number | null
}

/** Catalog-backed cart item (fixed-price or manual-price). */
export interface CatalogCartItem {
  kind: "catalog"
  product: CartProduct
  quantity: number
  /** Row-level identity for special (protected) items so repeated codes stay separate. */
  lineId?: string
  /** Manual line total as a canonical decimal string (special protected products only). */
  manualLineTotal?: string
}

/** Ad-hoc (non-catalog) cart item entered by the cashier in the scanner flow. */
export interface AdHocCartItem {
  kind: "ad-hoc"
  draftId: string
  name: string
  description?: string
  unitPrice: number
  quantity: number
  /** VAT rate: defaults to 10.5% for ad-hoc lines. */
  iva?: number | null
}

/** Discriminated union of all cart item kinds. */
export type CartItem = CatalogCartItem | AdHocCartItem

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

export function addItem(
  cart: Cart,
  product: CartProduct,
  quantity = 1,
  options?: AddItemOptions
): Cart {
  // Special products with lineId: always add as a new entry (never merge by product id)
  if (options?.lineId) {
    const newItem: CatalogCartItem = {
      kind: "catalog",
      product,
      quantity,
      lineId: options.lineId,
      manualLineTotal: options.manualLineTotal,
    }
    return { items: [...cart.items, newItem] }
  }

  // Normal products: merge by product id
  const existingIdx = cart.items.findIndex(
    (item) => item.kind === "catalog" && item.product.id === product.id
  )
  if (existingIdx >= 0) {
    const existing = cart.items[existingIdx] as CatalogCartItem
    return {
      items: cart.items.map((item, idx) =>
        idx === existingIdx
          ? { ...item, quantity: existing.quantity + quantity }
          : item
      ),
    }
  }
  const newItem: CatalogCartItem = { kind: "catalog", product, quantity }
  return { items: [...cart.items, newItem] }
}

/**
 * Add an ad-hoc item to the cart.
 * Ad-hoc items are NEVER merged — even when name and price match,
 * each entry stays as a separate row with its own draftId.
 */
export function addAdHocItem(
  cart: Cart,
  draftId: string,
  name: string,
  unitPrice: number,
  quantity: number,
  description?: string,
  iva: number | null = 10.5
): Cart {
  const newItem: AdHocCartItem = {
    kind: "ad-hoc",
    draftId,
    name,
    description,
    unitPrice,
    quantity,
    iva,
  }
  return { items: [...cart.items, newItem] }
}

export function changeQuantity(cart: Cart, productId: string, delta: number): Cart {
  return {
    items: cart.items.flatMap((item) => {
      if (item.kind !== "catalog" || item.product.id !== productId) return [item]
      const nextQty = Math.max(0, item.quantity + delta)
      return nextQty > 0 ? [{ ...item, quantity: nextQty }] : []
    }),
  }
}

export function removeItem(cart: Cart, productId: string): Cart {
  return {
    items: cart.items.filter(
      (item) => item.kind !== "catalog" || item.product.id !== productId
    ),
  }
}

/** Remove an ad-hoc item from the cart by its draftId. */
export function removeAdHocItem(cart: Cart, draftId: string): Cart {
  return {
    items: cart.items.filter(
      (item) => item.kind !== "ad-hoc" || item.draftId !== draftId
    ),
  }
}

// ---- Type guards ----

export function isCatalogItem(item: CartItem): item is CatalogCartItem {
  return item.kind === "catalog"
}

export function isAdHocItem(item: CartItem): item is AdHocCartItem {
  return item.kind === "ad-hoc"
}
