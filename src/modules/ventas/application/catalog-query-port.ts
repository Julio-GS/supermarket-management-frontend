import type { CartProductPromotion } from "../domain/cart"

export interface CatalogProduct {
  id: string
  name: string
  sku: string
  price: number
  stock: number | null
  /** Whether the product controls stock (from backend maneja_stock). */
  manejaStock: boolean
  unit: string
  promotions: CartProductPromotion[] | null
  storePromotions: CartProductPromotion[] | null
  /** Backend-defined pricing mode: "standard" (default) or "manual" (special product). */
  pricingMode?: "standard" | "manual"
  /** Whether the product is backend-protected (manual-price only, non-editable). */
  isProtected?: boolean
}

export interface CatalogFilters {
  search?: string
  page?: number
  limit?: number
}

export interface CatalogQueryPort {
  search(filters?: CatalogFilters): Promise<CatalogProduct[]>
  findByCode(code: string): Promise<CatalogProduct | null>
}
